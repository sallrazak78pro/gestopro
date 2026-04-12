// app/api/admin/stats/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import User from "@/lib/models/User";
import Vente from "@/lib/models/Vente";
import SessionCaisse from "@/lib/models/SessionCaisse";
import { getSuperAdminContext } from "@/lib/utils/tenant";

export async function GET() {
  try {
    const { userId, error } = await getSuperAdminContext();
    if (error) return error;
    await connectDB();

    const sixMoisAvant = new Date();
    sixMoisAvant.setMonth(sixMoisAvant.getMonth() - 6);

    const [
      totalTenants, tenantsActifs, tenantsSuspendus, tenantsEssai,
      totalUsers, totalVentes,
      sessionsOuvertes,
      derniersInscrits, parMois,
    ] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ statut: "actif" }),
      Tenant.countDocuments({ statut: "suspendu" }),
      Tenant.countDocuments({ statut: "essai" }),
      User.countDocuments({ tenantId: { $ne: null } }),
      Vente.countDocuments(),
      // Entreprises avec une session caisse active en ce moment
      SessionCaisse.distinct("tenantId", { statut: "ouverte" }),
      Tenant.find().sort({ createdAt: -1 }).limit(5).lean(),
      Tenant.aggregate([
        { $match: { createdAt: { $gte: sixMoisAvant } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalTenants, tenantsActifs, tenantsSuspendus, tenantsEssai,
        totalUsers, totalVentes,
        entreprisesConnectees: sessionsOuvertes.length,
      },
      parMois,
      derniersInscrits,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
