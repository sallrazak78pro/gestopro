// app/api/tresorerie/solde/route.ts
// Retourne le solde de caisse disponible d'une boutique
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementArgent from "@/lib/models/MouvementArgent";
import Vente from "@/lib/models/Vente";
import mongoose from "mongoose";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const boutiqueId = new URL(req.url).searchParams.get("boutiqueId");
    if (!boutiqueId)
      return NextResponse.json({ success: false, message: "boutiqueId requis" }, { status: 400 });

    const tid = new mongoose.Types.ObjectId(ctx.tenantId);
    const bid = new mongoose.Types.ObjectId(boutiqueId);

    // Toutes les requêtes en parallèle
    const [ventesRes, mouvsSortie, mouvsEntree, versRecusRes] = await Promise.all([
      Vente.aggregate([
        { $match: { boutique: bid, tenantId: tid, statut: "payee" } },
        { $group: { _id: null, total: { $sum: "$montantTotal" } } },
      ]),
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, boutique: bid,
            type: { $in: ["versement_boutique","versement_banque","depense","achat_direct","retrait_tiers","remboursement"] } } },
        { $group: { _id: null, total: { $sum: "$montant" } } },
      ]),
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, boutique: bid, type: { $in: ["depot_tiers","avance_caisse"] } } },
        { $group: { _id: null, total: { $sum: "$montant" } } },
      ]),
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, type: "versement_boutique", boutiqueDestination: bid } },
        { $group: { _id: null, total: { $sum: "$montant" } } },
      ]),
    ]);

    const totalVentes     = ventesRes[0]?.total    ?? 0;
    const totalSorties    = mouvsSortie[0]?.total   ?? 0;
    const totalEntrees    = mouvsEntree[0]?.total    ?? 0;
    const versementsRecus = versRecusRes[0]?.total   ?? 0;

    const soldeCaisse = totalVentes + totalEntrees + versementsRecus - totalSorties;

    return NextResponse.json({
      success: true,
      data: {
        soldeCaisse: Math.max(0, soldeCaisse),
        detail: { totalVentes, totalEntrees, versementsRecus, totalSorties },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
