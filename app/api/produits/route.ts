// app/api/produits/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Produit from "@/lib/models/Produit";
import { getTenantContext, requirePermission } from "@/lib/utils/tenant";
import { peutVoirPrixRevient } from "@/lib/utils/permissions";
import { genererReference } from "@/lib/utils/reference";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "stock", "view");
    if (denied) return denied;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId, actif: true };
    if (searchParams.get("search")) query.$or = [
      { nom:       { $regex: searchParams.get("search"), $options: "i" } },
      { reference: { $regex: searchParams.get("search"), $options: "i" } },
    ];
    if (searchParams.get("categorie")) query.categorie = searchParams.get("categorie");

    // L'image (base64) est lourde et rarement utile — exclue par défaut,
    // seule la vente au comptoir (miniature produit) la redemande explicitement.
    // Le prix d'achat (prix de revient) ne doit être visible qu'à l'admin.
    const exclude = [
      searchParams.get("avecImage") ? null : "image",
      peutVoirPrixRevient(ctx.role, ctx.tenantPermissions) ? null : "prixAchat",
    ].filter(Boolean).map(f => `-${f}`).join(" ");
    const produits = await Produit.find(query, exclude || undefined).sort({ nom: 1 }).lean();
    return NextResponse.json({ success: true, data: produits });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "stock", "create");
    if (denied) return denied;
    await connectDB();
    const body = await req.json();
    if (!body.reference) {
      body.reference = await genererReference(ctx.tenantId, "PRD");
    }
    const voitCout = peutVoirPrixRevient(ctx.role, ctx.tenantPermissions);
    // Sans le droit « Marges et prix de revient », on ne fixe pas le coût
    // d'achat à la création : l'admin le complètera plus tard.
    if (!voitCout) body.prixAchat = 0;
    const produit = await Produit.create({ ...body, tenantId: ctx.tenantId });
    const data = voitCout ? produit : (({ prixAchat, ...rest }) => rest)(produit.toObject());

    await logActivity({
      tenantId: ctx.tenantId, userId: ctx.userId, userNom: ctx.userNom, role: ctx.role,
      action: ACTIONS.PRODUIT_CREE, module: MODULES.STOCK,
      details: `Produit créé — ${produit.nom} (${produit.reference})`,
      reference: produit.reference,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Référence déjà utilisée" }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
