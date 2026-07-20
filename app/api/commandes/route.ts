// app/api/commandes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Fournisseur from "@/lib/models/Fournisseur";
import Produit from "@/lib/models/Produit";
import { getTenantContext } from "@/lib/utils/tenant";
import { genererReference } from "@/lib/utils/reference";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    if (searchParams.get("statut"))     query.statut     = searchParams.get("statut");
    if (searchParams.get("fournisseur")) query.fournisseur = searchParams.get("fournisseur");

    // Filtres "réception" et "paiement" — indépendants du statut détaillé,
    // combinés via $and pour ne pas entrer en conflit avec un filtre statut déjà posé.
    const andConditions: any[] = [];
    const reception = searchParams.get("reception");
    if (reception === "recue")               andConditions.push({ statut: "recue" });
    if (reception === "recue_partiellement") andConditions.push({ statut: "recue_partiellement" });
    if (reception === "non_recue")           andConditions.push({ statut: { $in: ["brouillon", "envoyee"] } });

    const paiement = searchParams.get("paiement");
    if (paiement === "paye")  andConditions.push({ montantDu: 0, statut: { $ne: "annulee" } });
    if (paiement === "reste") andConditions.push({ montantDu: { $gt: 0 }, statut: { $ne: "annulee" } });

    if (andConditions.length > 0) query.$and = andConditions;

    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");
    if (dateDebut || dateFin) {
      query.createdAt = {};
      if (dateDebut) query.createdAt.$gte = new Date(dateDebut);
      if (dateFin)   { const f = new Date(dateFin); f.setHours(23, 59, 59, 999); query.createdAt.$lte = f; }
    }

    if (searchParams.get("search")) {
      const regex = { $regex: searchParams.get("search"), $options: "i" };
      const matchingFournisseurs = await Fournisseur.find({ tenantId: ctx.tenantId, nom: regex }).select("_id").lean();
      query.$or = [
        { reference: regex },
        { fournisseur: { $in: matchingFournisseurs.map(f => f._id) } },
      ];
    }

    const page  = parseInt(searchParams.get("page")  ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const skip  = (page - 1) * limit;

    // Le total dû porte sur tout l'ensemble filtré, pas seulement la page affichée.
    const [commandes, total, toutesLesCommandes] = await Promise.all([
      CommandeFournisseur.find(query)
        .populate("fournisseur", "nom telephone")
        .populate("destination", "nom type")
        .populate("createdBy", "nom")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      CommandeFournisseur.countDocuments(query),
      CommandeFournisseur.find(query).select("statut montantDu dateReception createdAt").lean(),
    ]);
    const totalDu = toutesLesCommandes.filter(c=>c.statut!=="annulee").reduce((s,c)=>s+c.montantDu,0);
    const now = new Date();
    const enCours    = toutesLesCommandes.filter(c => ["envoyee","recue_partiellement"].includes(c.statut)).length;
    const recuesMois = toutesLesCommandes.filter(c => c.statut === "recue"
      && new Date(c.dateReception ?? c.createdAt).getMonth() === now.getMonth()
      && new Date(c.dateReception ?? c.createdAt).getFullYear() === now.getFullYear()).length;
    return NextResponse.json({
      success: true, data: commandes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: { total, totalDu, enCours, recuesMois },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin","superadmin","gestionnaire"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();
    const { fournisseurId, destinationId, lignes, dateLivraison, note, statut } = await req.json();
    if (!fournisseurId || !destinationId || !lignes?.length)
      return NextResponse.json({ success: false, message: "Données manquantes." }, { status: 400 });

    // Enrichir les lignes avec les noms des produits
    const lignesEnrichies = await Promise.all(lignes.map(async (l: any) => {
      const produit = await Produit.findOne({ _id: l.produitId, tenantId: ctx.tenantId }, "nom").lean() as any;
      if (!produit) throw new Error(`Produit introuvable: ${l.produitId}`);
      return {
        produit: l.produitId,
        nomProduit: produit.nom,
        quantiteCommandee: l.quantite,
        quantiteRecue: 0,
        prixUnitaire: l.prixUnitaire,
        sousTotal: l.quantite * l.prixUnitaire,
      };
    }));

    const montantTotal = lignesEnrichies.reduce((s, l) => s + l.sousTotal, 0);
    const reference = await genererReference(ctx.tenantId, `CMD-${new Date().getFullYear()}`);

    const commande = await CommandeFournisseur.create({
      tenantId: ctx.tenantId,
      reference, fournisseur: fournisseurId, destination: destinationId,
      lignes: lignesEnrichies, montantTotal,
      montantPaye: 0, montantDu: montantTotal,
      statut: statut || "envoyee",
      dateCommande: new Date(),
      dateLivraison: dateLivraison ? new Date(dateLivraison) : null,
      note: note || "",
      createdBy: ctx.userId,
    });

    // Mettre à jour le solde du fournisseur
    await Fournisseur.findByIdAndUpdate(fournisseurId, { $inc: { soldeCredit: montantTotal } });

    const populated = await CommandeFournisseur.findById(commande._id)
      .populate("fournisseur", "nom").populate("destination", "nom type");
    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
