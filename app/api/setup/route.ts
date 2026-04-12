// app/api/setup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";

// GET — vérifie si le setup est nécessaire
export async function GET() {
  try {
    await connectDB();
    const count = await User.countDocuments({ role: "superadmin" });
    return NextResponse.json({ needsSetup: count === 0 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST — crée uniquement le Super Admin plateforme (pas de tenant, pas de boutiques)
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // Bloquer si un superadmin existe déjà
    const count = await User.countDocuments({ role: "superadmin" });
    if (count > 0) {
      return NextResponse.json(
        { success: false, message: "Le Super Admin existe déjà." },
        { status: 403 }
      );
    }

    const { nom, email, password } = await req.json();

    if (!nom || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Tous les champs sont requis." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Mot de passe minimum 8 caractères." },
        { status: 400 }
      );
    }

    // Créer le superadmin SANS tenantId ni boutique
    const user = await User.create({
      nom,
      email: email.toLowerCase().trim(),
      password, // hashé par le pre-save hook du modèle User
      role: "superadmin",
      tenantId: null,
      boutique: null,
      actif: true,
    });

    return NextResponse.json({
      success: true,
      message: "Super Admin créé avec succès.",
      data: { email: user.email },
    });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Cet email est déjà utilisé." }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
