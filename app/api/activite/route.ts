// app/api/activite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ActivityLog from "@/lib/models/ActivityLog";
import { getTenantContext } from "@/lib/utils/tenant";

const MODULE_ICONS: Record<string, string> = {
  ventes: "🧾", caisse: "🏧", stock: "📦",
  tresorerie: "💳", employes: "👷", auth: "🔐", utilisateurs: "👤",
};

const ACTION_LABELS: Record<string, string> = {
  vente_creee:    "Vente enregistrée",
  vente_annulee:  "Vente annulée",
  vente_encaissee:"Vente encaissée",
  caisse_ouverte: "Caisse ouverte",
  caisse_fermee:  "Caisse fermée",
  stock_ajuste:   "Stock ajusté",
  produit_cree:   "Produit créé",
  produit_modifie:"Produit modifié",
  produit_supprime:"Produit supprimé",
  mouvement_cree: "Mouvement créé",
  user_cree:      "Utilisateur créé",
  user_modifie:   "Utilisateur modifié",
  user_supprime:  "Utilisateur supprimé",
  connexion:      "Connexion",
};

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;

    // Réservé aux admins
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const page    = parseInt(searchParams.get("page") ?? "1");
    const limit   = parseInt(searchParams.get("limit") ?? "50");
    const module  = searchParams.get("module") ?? "";
    const userId  = searchParams.get("userId") ?? "";
    const debut   = searchParams.get("debut");
    const fin     = searchParams.get("fin");

    const query: any = { tenantId: ctx.tenantId };
    if (module)  query.module  = module;
    if (userId)  query.userId  = userId;
    if (debut && fin) {
      query.createdAt = {
        $gte: new Date(debut + "T00:00:00"),
        $lte: new Date(fin   + "T23:59:59"),
      };
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("boutique", "nom")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    const enriched = logs.map((l: any) => ({
      ...l,
      icon:         MODULE_ICONS[l.module]    ?? "📋",
      actionLabel:  ACTION_LABELS[l.action]   ?? l.action,
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
