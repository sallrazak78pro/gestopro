// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import ResetToken from "@/lib/models/ResetToken";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ success: false, message: "Email requis." }, { status: 400 });

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase(), actif: true });

    // Toujours renvoyer succès pour ne pas révéler si l'email existe
    if (!user) return NextResponse.json({ success: true });

    // Supprimer les anciens tokens de cet utilisateur
    await ResetToken.deleteMany({ userId: user._id });

    // Générer token sécurisé — stocké en MongoDB (persistant)
    const rawToken  = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await ResetToken.create({ userId: user._id, token: rawToken, expiresAt });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`;

    // ── TODO : Envoyer l'email via Resend ──────────────────────────
    // Installer : npm install resend
    // import { Resend } from "resend";
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from:    "GestoPro <noreply@votredomaine.com>",
    //   to:      email,
    //   subject: "Réinitialisation de votre mot de passe GestoPro",
    //   html: `
    //     <p>Bonjour,</p>
    //     <p>Cliquez sur ce lien pour réinitialiser votre mot de passe :</p>
    //     <a href="${resetUrl}">${resetUrl}</a>
    //     <p>Ce lien expire dans 1 heure.</p>
    //     <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
    //   `,
    // });
    // ── FIN TODO ───────────────────────────────────────────────────

    // En attendant l'intégration email, le lien est disponible dans les logs Vercel
    if (process.env.NODE_ENV !== "production") {
      console.info(`[DEV] Lien reset: ${resetUrl}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password)
      return NextResponse.json({ success: false, message: "Données manquantes." }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ success: false, message: "Mot de passe trop court (8 caractères min)." }, { status: 400 });

    await connectDB();

    // Récupérer le token depuis MongoDB
    const entry = await ResetToken.findOne({ token, used: false });
    if (!entry)
      return NextResponse.json({ success: false, message: "Lien invalide ou déjà utilisé." }, { status: 400 });
    if (new Date() > entry.expiresAt) {
      await ResetToken.deleteOne({ _id: entry._id });
      return NextResponse.json({ success: false, message: "Lien expiré. Demandez un nouveau." }, { status: 400 });
    }

    const user = await User.findById(entry.userId);
    if (!user)
      return NextResponse.json({ success: false, message: "Utilisateur introuvable." }, { status: 404 });

    // Mettre à jour le mot de passe
    user.password = password; // hashé par le pre-save hook
    await user.save();

    // Marquer le token comme utilisé (le TTL index le supprimera automatiquement)
    entry.used = true;
    await entry.save();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
