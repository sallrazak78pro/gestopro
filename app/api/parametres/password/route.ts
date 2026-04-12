// app/api/parametres/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getTenantContext } from "@/lib/utils/tenant";

export async function PUT(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { ancienPassword, nouveauPassword } = await req.json();
    if (!ancienPassword || !nouveauPassword)
      return NextResponse.json({ success: false, message: "Tous les champs sont requis." }, { status: 400 });
    if (nouveauPassword.length < 6)
      return NextResponse.json({ success: false, message: "Nouveau mot de passe minimum 6 caractères." }, { status: 400 });

    const user = await User.findById(ctx.userId);
    if (!user)
      return NextResponse.json({ success: false, message: "Utilisateur introuvable." }, { status: 404 });

    const ok = await user.comparePassword(ancienPassword);
    if (!ok)
      return NextResponse.json({ success: false, message: "Ancien mot de passe incorrect." }, { status: 400 });

    user.password = nouveauPassword; // hashé par le pre-save hook
    await user.save();

    return NextResponse.json({ success: true, message: "Mot de passe modifié avec succès." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
