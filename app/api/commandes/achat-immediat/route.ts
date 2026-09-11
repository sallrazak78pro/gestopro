// app/api/commandes/achat-immediat/route.ts
// Achat local immédiat par une boutique secondaire : crée la commande,
// la réceptionne intégralement et la paie en une seule action — remplace
// l'ancien mouvement de trésorerie "achat_direct" (retiré), qui ne
// touchait ni le stock ni un fournisseur identifié.
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Fournisseur from "@/lib/models/Fournisseur";
import Boutique from "@/lib/models/Boutique";
import Produit from "@/lib/models/Produit";
import Stock from "@/lib/models/Stock";
import MouvementStock from "@/lib/models/MouvementStock";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext, canAccessBoutique, requirePermission } from "@/lib/utils/tenant";
import { calculerSoldeCaisse } from "@/lib/utils/tresorerie";
import { calculerCUMP } from "@/lib/utils/cump";
import { genererReference } from "@/lib/utils/reference";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const deniedCreate = requirePermission(ctx, "commandes", "create");
    if (deniedCreate) return deniedCreate;
    const deniedEdit = requirePermission(ctx, "commandes", "edit");
    if (deniedEdit) return deniedEdit;
    await connectDB();

    const { fournisseurId, destinationId, lignes, note } = await req.json();
    if (!fournisseurId || !destinationId || !lignes?.length)
      return NextResponse.json({ success: false, message: "Données manquantes." }, { status: 400 });

    if (!canAccessBoutique(ctx, destinationId))
      return NextResponse.json({ success: false, message: "Accès refusé à cette boutique." }, { status: 403 });

    const destination = await Boutique.findOne({ _id: destinationId, tenantId: ctx.tenantId });
    if (!destination)
      return NextResponse.json({ success: false, message: "Boutique introuvable." }, { status: 404 });
    if (destination.type !== "boutique" || destination.estPrincipale)
      return NextResponse.json({
        success: false,
        message: "L'achat immédiat est réservé aux boutiques secondaires — utilisez le flux commande classique (créer, réceptionner, payer) pour la boutique principale ou un dépôt.",
      }, { status: 400 });

    const fournisseur = await Fournisseur.findOne({ _id: fournisseurId, tenantId: ctx.tenantId });
    if (!fournisseur)
      return NextResponse.json({ success: false, message: "Fournisseur introuvable." }, { status: 404 });

    // Enrichir les lignes avec les noms des produits (comme une commande normale)
    const lignesEnrichies = await Promise.all(lignes.map(async (l: any) => {
      const produit = await Produit.findOne({ _id: l.produitId, tenantId: ctx.tenantId }, "nom").lean() as any;
      if (!produit) throw new Error(`Produit introuvable: ${l.produitId}`);
      return {
        produit: l.produitId,
        nomProduit: produit.nom,
        quantiteCommandee: l.quantite,
        quantiteRecue: l.quantite, // reçu intégralement, tout de suite
        prixUnitaire: l.prixUnitaire,
        sousTotal: l.quantite * l.prixUnitaire,
      };
    }));

    const montantTotal = lignesEnrichies.reduce((s, l) => s + l.sousTotal, 0);

    // L'argent sort immédiatement de la caisse de la boutique — vérifier
    // qu'elle dispose bien du montant avant de créer quoi que ce soit.
    const { soldeCaisse } = await calculerSoldeCaisse(ctx.tenantId, destinationId);
    if (montantTotal > soldeCaisse)
      return NextResponse.json({
        success: false,
        message: `Solde insuffisant. Disponible en caisse : ${new Intl.NumberFormat("fr-FR").format(soldeCaisse)} F.`,
      }, { status: 400 });

    const reference = await genererReference(ctx.tenantId, `CMD-${new Date().getFullYear()}`);
    const now = new Date();

    const commande = await CommandeFournisseur.create({
      tenantId: ctx.tenantId,
      reference, fournisseur: fournisseurId, destination: destinationId,
      lignes: lignesEnrichies, montantTotal,
      montantPaye: montantTotal, montantDu: 0,
      statut: "recue",
      dateCommande: now, dateReception: now,
      note: note || "",
      createdBy: ctx.userId,
    });

    // Impact stock — CUMP tenant, comme une réception normale (sans frais
    // de livraison : ce champ n'existe pas dans ce flux express).
    const lignesMouvement: { produit: any; quantite: number; prixUnitaire: number; montant: number }[] = [];
    for (const l of lignesEnrichies) {
      const [aggTenant, produitAvant] = await Promise.all([
        Stock.aggregate([
          { $match: {
            produit:  new mongoose.Types.ObjectId(l.produit.toString()),
            tenantId: new mongoose.Types.ObjectId(ctx.tenantId.toString()),
          } },
          { $group: { _id: null, total: { $sum: "$quantite" } } },
        ]),
        Produit.findOne({ _id: l.produit, tenantId: ctx.tenantId }, "prixAchat").lean() as any,
      ]);

      await Stock.findOneAndUpdate(
        { produit: l.produit, boutique: destinationId, tenantId: ctx.tenantId },
        { $inc: { quantite: l.quantiteCommandee }, $setOnInsert: { tenantId: ctx.tenantId } },
        { upsert: true }
      );

      const cumpTenant = calculerCUMP(aggTenant[0]?.total ?? 0, produitAvant?.prixAchat ?? 0, l.quantiteCommandee, l.prixUnitaire);
      await Produit.findOneAndUpdate({ _id: l.produit, tenantId: ctx.tenantId }, { prixAchat: Math.round(cumpTenant) });

      lignesMouvement.push({
        produit: l.produit, quantite: l.quantiteCommandee,
        prixUnitaire: l.prixUnitaire, montant: l.sousTotal,
      });
    }

    await MouvementStock.create({
      tenantId:  ctx.tenantId,
      reference: await genererReference(ctx.tenantId, `MV-${new Date().getFullYear()}`),
      boutique:  destinationId,
      type:      "entree",
      lignes:    lignesMouvement,
      montant:   montantTotal,
      motif:     `Achat immédiat — ${reference}${note ? ` — ${note}` : ""}`,
      createdBy: ctx.userId,
    });

    // Paiement — une boutique secondaire paie toujours pour le compte de la
    // principale : versement automatique, comme pour le paiement d'une
    // commande classique (cf. /api/commandes/[id]/payer).
    const principale = await Boutique.findOne({ tenantId: ctx.tenantId, estPrincipale: true, type: "boutique" });
    await MouvementArgent.create({
      tenantId:            ctx.tenantId,
      reference:           await genererReference(ctx.tenantId, `VRS-${new Date().getFullYear()}`),
      type:                "versement_boutique",
      boutique:            destinationId,
      boutiqueDestination: principale?._id ?? null,
      montant:             montantTotal,
      statut:              "en_attente", // doit passer par la validation admin, comme tout versement inter-boutique
      motif:               `Avance commande — Achat immédiat ${fournisseur.nom} — ${reference}${note ? ` — ${note}` : ""}`,
      commandeId:          commande._id,
      createdBy:           ctx.userId,
    });

    const populated = await CommandeFournisseur.findById(commande._id)
      .populate("fournisseur", "nom").populate("destination", "nom type");

    await logActivity({
      tenantId: ctx.tenantId, userId: ctx.userId, userNom: ctx.userNom, role: ctx.role,
      action: ACTIONS.COMMANDE_CREEE, module: MODULES.COMMANDES,
      details: `Achat immédiat (reçu et payé) — ${fournisseur.nom} — ${new Intl.NumberFormat("fr-FR").format(montantTotal)} F`,
      reference, boutique: destinationId,
    });

    return NextResponse.json({
      success: true, data: populated,
      message: "Achat enregistré — marchandise reçue et versement créé vers la boutique principale, en attente de confirmation admin.",
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
