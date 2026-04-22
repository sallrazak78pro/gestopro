// app/api/mouvements-stock/migrate/route.ts
// Migre les anciens mouvements (schéma source/destination) vers le nouveau (boutique)
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementStock from "@/lib/models/MouvementStock";
import Produit from "@/lib/models/Produit";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 });

    await connectDB();

    // Trouver tous les anciens documents qui ont source/destination (ancien schéma)
    // On les détecte par l'absence du champ "boutique" ou par la présence de "statut" (ancien champ)
    const anciens = await (MouvementStock as any).collection.find({
      tenantId: ctx.tenantId,
      $or: [
        { boutique: { $exists: false } },
        { statut:   { $exists: true  } },
      ],
    }).toArray();

    if (anciens.length === 0)
      return NextResponse.json({ success: true, message: "Aucun ancien mouvement à migrer.", migrated: 0 });

    const mongoose = (await import("mongoose")).default;
    let migrated = 0;
    let deleted  = 0;

    for (const old of anciens) {
      // Récupérer le prix d'achat du produit
      const produit = await Produit.findById(old.produit).lean() as any;
      const prixUnitaire = produit?.prixAchat ?? 0;
      const quantite     = old.quantite ?? 0;
      const montant      = quantite * prixUnitaire;
      const createdBy    = old.createdBy;
      const tenantId     = old.tenantId;
      const produitId    = old.produit;
      const motif        = old.motif || "";
      const createdAt    = old.createdAt;
      const transfertRef = (old.source && old.destination) ? randomUUID() : null;

      // Supprimer l'ancien document
      await (MouvementStock as any).collection.deleteOne({ _id: old._id });
      deleted++;

      // Créer le(s) nouveau(x) document(s)
      const makeRef = async () => {
        const count = await MouvementStock.countDocuments({ tenantId });
        return `MV-${new Date(createdAt).getFullYear()}-${String(count + 1).padStart(4, "0")}`;
      };

      if (old.type === "entree_fournisseur") {
        // entree dans destination
        if (old.destination) {
          await MouvementStock.create({
            tenantId, reference: await makeRef(),
            boutique: old.destination, type: "entree",
            produit: produitId, quantite, prixUnitaire, montant,
            motif: motif || "Réception fournisseur (migré)",
            transfertRef: null, createdBy, createdAt,
          });
          migrated++;
        }
      } else if (old.type === "sortie_perte") {
        // sortie depuis source
        if (old.source) {
          await MouvementStock.create({
            tenantId, reference: await makeRef(),
            boutique: old.source, type: "sortie",
            produit: produitId, quantite, prixUnitaire, montant,
            motif: motif || "Sortie/Perte (migré)",
            transfertRef: null, createdBy, createdAt,
          });
          migrated++;
        }
      } else {
        // depot_vers_boutique ou boutique_vers_boutique → 2 mouvements liés
        if (old.source) {
          await MouvementStock.create({
            tenantId, reference: await makeRef(),
            boutique: old.source, type: "sortie",
            produit: produitId, quantite, prixUnitaire, montant,
            motif: motif || "Transfert (migré)",
            transfertRef, createdBy, createdAt,
          });
          migrated++;
        }
        if (old.destination) {
          await MouvementStock.create({
            tenantId, reference: await makeRef(),
            boutique: old.destination, type: "entree",
            produit: produitId, quantite, prixUnitaire, montant,
            motif: motif || "Transfert (migré)",
            transfertRef, createdBy, createdAt,
          });
          migrated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration terminée : ${deleted} ancien(s) supprimé(s), ${migrated} nouveau(x) créé(s).`,
      deleted,
      migrated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
