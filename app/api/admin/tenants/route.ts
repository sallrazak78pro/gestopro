// app/api/admin/tenants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import User from "@/lib/models/User";
import Vente from "@/lib/models/Vente";
import Boutique from "@/lib/models/Boutique";
import mongoose from "mongoose";
import { getSuperAdminContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { userId, error } = await getSuperAdminContext();
    if (error) return error;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const statut = searchParams.get("statut") || "";

    const query: any = {};
    if (search) query.$or = [
      { nom: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
    if (statut) query.statut = statut;

    const tenants = await Tenant.find(query).sort({ createdAt: -1 });
    const tenantIds = tenants.map(t => t._id);

    // Toutes les stats en parallèle — une requête groupée par métrique
    const [usersCount, boutiquesCount, ventesStats] = await Promise.all([
      User.aggregate([
        { $match: { tenantId: { $in: tenantIds } } },
        { $group: { _id: "$tenantId", nb: { $sum: 1 } } },
      ]),
      Boutique.aggregate([
        { $match: { tenantId: { $in: tenantIds }, actif: true } },
        { $group: { _id: "$tenantId", nb: { $sum: 1 } } },
      ]),
      Vente.aggregate([
        { $match: { tenantId: { $in: tenantIds }, statut: "payee" } },
        { $group: { _id: "$tenantId", nb: { $sum: 1 }, ca: { $sum: "$montantTotal" } } },
      ]),
    ]);

    const toMap = (arr: any[], key = "nb") => {
      const m: Record<string, number> = {};
      arr.forEach(r => { m[r._id.toString()] = r[key]; });
      return m;
    };

    const usersMap    = toMap(usersCount);
    const boutiquesMap= toMap(boutiquesCount);
    const ventesNbMap = toMap(ventesStats);
    const ventesCAMap = toMap(ventesStats, "ca");

    const enriched = tenants.map(t => ({
      ...t.toObject(),
      nbUsers:    usersMap[t._id.toString()]     ?? 0,
      nbBoutiques:boutiquesMap[t._id.toString()] ?? 0,
      nbVentes:   ventesNbMap[t._id.toString()]  ?? 0,
      caTotal:    ventesCAMap[t._id.toString()]  ?? 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
