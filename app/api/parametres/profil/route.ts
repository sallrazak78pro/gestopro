// app/api/parametres/profil/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getTenantContext } from "@/lib/utils/tenant";

export async function PUT(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { nom, prenom, telephone } = await req.json();
    if (!nom || !prenom)
      return NextResponse.json({ success: false, message: "Nom et prénom requis." }, { status: 400 });

    const user = await User.findByIdAndUpdate(
      ctx.userId,
      { $set: { nom, prenom, telephone: telephone || "" } },
      { new: true }
    );

    if (!user)
      return NextResponse.json({ success: false, message: "Utilisateur introuvable." }, { status: 404 });

    return NextResponse.json({ success: true, data: { nom: user.nom, prenom: user.prenom } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
