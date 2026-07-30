// app/api/ventes/migrate-employe/route.ts
// Avant une correction antérieure, Vente.employe pointait vers User._id au
// lieu d'Employe._id — les ventes créées à cette époque ont donc une
// référence "orpheline" (elle ne résout plus dans la collection Employe),
// ce qui casse le classement des ventes (poste/boutique manquants). On
// retrouve l'Employe correspondant via son lien Employe.userId et on
// réécrit la référence.
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vente from "@/lib/models/Vente";
import Employe from "@/lib/models/Employe";
import { getTenantContext } from "@/lib/utils/tenant";

async function resolutionMap(tenantId: string) {
  const employeIds = new Set(
    (await Employe.find({ tenantId }, "_id").lean()).map((e: any) => e._id.toString())
  );
  const orphanIds = (await Vente.distinct("employe", { tenantId })).filter(
    (id: any) => id && !employeIds.has(id.toString())
  );
  if (orphanIds.length === 0) return { orphanIds: [] as any[], userIdToEmployeId: new Map<string, string>() };

  const employesLies = await Employe.find(
    { tenantId, userId: { $in: orphanIds } },
    "_id userId"
  ).lean();
  const userIdToEmployeId = new Map<string, string>(
    employesLies.map((e: any) => [e.userId.toString(), e._id.toString()])
  );
  return { orphanIds, userIdToEmployeId };
}

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 });

    await connectDB();
    const { orphanIds, userIdToEmployeId } = await resolutionMap(ctx.tenantId.toString());
    const resolvableIds = orphanIds.filter(id => userIdToEmployeId.has(id.toString()));

    const count = resolvableIds.length === 0 ? 0 : await Vente.countDocuments({
      tenantId: ctx.tenantId,
      employe: { $in: resolvableIds },
    });

    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 });

    await connectDB();
    const { userIdToEmployeId } = await resolutionMap(ctx.tenantId.toString());

    let migrated = 0;
    for (const [userId, employeId] of userIdToEmployeId) {
      const res = await Vente.updateMany(
        { tenantId: ctx.tenantId, employe: userId },
        { $set: { employe: employeId } }
      );
      migrated += res.modifiedCount;
    }

    return NextResponse.json({
      success: true,
      message: migrated > 0
        ? `Migration terminée : ${migrated} vente(s) rattachée(s) au bon employé.`
        : "Aucune vente à migrer.",
      migrated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
