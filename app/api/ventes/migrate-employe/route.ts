// app/api/ventes/migrate-employe/route.ts
// Avant une correction antérieure, Vente.employe pointait vers User._id au
// lieu d'Employe._id — les ventes créées à cette époque ont donc une
// référence "orpheline" (elle ne résout plus dans la collection Employe),
// ce qui casse le classement des ventes (poste/boutique manquants).
//
// Chaque référence orpheline qui est un compte du tenant est rattachée à la
// fiche liée à ce compte POUR LA BOUTIQUE DE LA VENTE, créée si elle n'existe
// pas encore — la même fiche qu'utilise une nouvelle vente faite par ce compte
// (cf. lib/utils/ficheCompte.ts). Auparavant seules les ventes dont le compte
// avait déjà une fiche étaient réparables, le reste restait bloqué.
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vente from "@/lib/models/Vente";
import Employe from "@/lib/models/Employe";
import User from "@/lib/models/User";
import { getTenantContext } from "@/lib/utils/tenant";
import { ficheEmployePourCompte } from "@/lib/utils/ficheCompte";

/** Comptes du tenant vers lesquels pointent encore des ventes (référence orpheline). */
async function comptesOrphelins(tenantId: string) {
  const employeIds = new Set(
    (await Employe.find({ tenantId }, "_id").lean()).map((e: any) => e._id.toString())
  );
  const orphanIds = (await Vente.distinct("employe", { tenantId })).filter(
    (id: any) => id && !employeIds.has(id.toString())
  );
  if (orphanIds.length === 0) return [];
  return User.find({ _id: { $in: orphanIds }, tenantId }, "nom prenom role").lean() as Promise<any[]>;
}

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 });

    await connectDB();
    const comptes = await comptesOrphelins(ctx.tenantId.toString());
    const count = comptes.length === 0 ? 0 : await Vente.countDocuments({
      tenantId: ctx.tenantId,
      employe: { $in: comptes.map(u => u._id) },
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
    const comptes = await comptesOrphelins(ctx.tenantId.toString());

    let migrated = 0;
    for (const user of comptes) {
      const boutiques = await Vente.distinct("boutique", { tenantId: ctx.tenantId, employe: user._id });
      for (const boutiqueId of boutiques) {
        const fiche = await ficheEmployePourCompte(ctx.tenantId, boutiqueId, user);
        const res = await Vente.updateMany(
          { tenantId: ctx.tenantId, employe: user._id, boutique: boutiqueId },
          { $set: { employe: fiche._id } }
        );
        migrated += res.modifiedCount;
      }
    }

    return NextResponse.json({
      success: true,
      message: migrated > 0
        ? `Migration terminée : ${migrated} vente(s) rattachée(s) au bon vendeur.`
        : "Aucune vente à migrer.",
      migrated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
