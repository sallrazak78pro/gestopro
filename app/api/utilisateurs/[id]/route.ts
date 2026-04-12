// app/api/utilisateurs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getTenantContext } from "@/lib/utils/tenant";

// PUT — modifier un utilisateur (infos, rôle, boutique, actif)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });

    await connectDB();

    // Vérifier que l'utilisateur appartient bien au même tenant
    const user = await User.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!user)
      return NextResponse.json({ success: false, message: "Utilisateur introuvable" }, { status: 404 });

    // Empêcher de se modifier soi-même le rôle ou de se désactiver
    if (id === ctx.userId)
      return NextResponse.json({ success: false, message: "Vous ne pouvez pas modifier votre propre compte ici." }, { status: 400 });

    const body = await req.json();
    const { nom, email, role, boutiqueId, actif, password } = body;

    // Construire l'objet de mise à jour
    const update: any = {};
    if (nom)       update.nom      = nom;
    if (email)     update.email    = email.toLowerCase();
    if (role)      update.role     = role;
    if (boutiqueId !== undefined) update.boutique = boutiqueId || null;
    if (actif !== undefined)      update.actif    = actif;

    // Changement de mot de passe : utiliser save() pour déclencher le hash
    if (password && password.length >= 6) {
      user.set(update);
      user.password = password; // sera hashé par le pre-save hook
      await user.save();
      const { password: _, ...safe } = user.toObject();
      return NextResponse.json({ success: true, data: safe });
    }

    const updated = await User.findByIdAndUpdate(id, update, { new: true })
      .populate("boutique", "nom type")
      .select("-password");

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Cet email est déjà utilisé." }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// DELETE — désactivation douce (ne supprime pas vraiment)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });

    if (id === ctx.userId)
      return NextResponse.json({ success: false, message: "Vous ne pouvez pas désactiver votre propre compte." }, { status: 400 });

    await connectDB();
    const user = await User.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!user)
      return NextResponse.json({ success: false, message: "Utilisateur introuvable" }, { status: 404 });

    await User.findByIdAndUpdate(id, { actif: false });
    return NextResponse.json({ success: true, message: "Utilisateur désactivé." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
