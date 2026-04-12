// app/api/commandes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Fournisseur from "@/lib/models/Fournisseur";
import Produit from "@/lib/models/Produit";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    if (searchParams.get("statut"))     query.statut     = searchParams.get("statut");
    if (searchParams.get("fournisseur")) query.fournisseur = searchParams.get("fournisseur");
    const commandes = await CommandeFournisseur.find(query)
      .populate("fournisseur", "nom telephone")
      .populate("destination", "nom type")
      .populate("createdBy", "nom")
      .sort({ createdAt: -1 }).limit(50);
    const totalDu = commandes.filter(c=>c.statut!=="annulee").reduce((s,c)=>s+c.montantDu,0);
    return NextResponse.json({ success: true, data: commandes, stats: { total: commandes.length, totalDu } });
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
      const produit = await Produit.findOne({ _id: l.produitId, tenantId: ctx.tenantId });
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
    const count = await CommandeFournisseur.countDocuments({ tenantId: ctx.tenantId });
    const reference = `CMD-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

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
