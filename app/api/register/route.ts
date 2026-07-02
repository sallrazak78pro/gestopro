// app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import User from "@/lib/models/User";
import Boutique from "@/lib/models/Boutique";
import { checkRateLimit, getClientIp } from "@/lib/utils/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit par IP — anti spam/brute-force sur la création de comptes
    const rl = checkRateLimit(`register:${getClientIp(req)}`);
    if (!rl.allowed) {
      const minutes = Math.ceil((rl.retryAfter ?? 1800) / 60);
      return NextResponse.json(
        { success: false, message: `Trop de tentatives. Réessayez dans ${minutes} min.` },
        { status: 429 }
      );
    }

    await connectDB();
    const {
      entreprise, pays, ville, telephone,
      nom, email, password,
      boutiquesNoms, depotNom,
    } = await req.json();

    // Validations de base
    if (!entreprise || !email || !password || !nom)
      return NextResponse.json({ success: false, message: "Tous les champs obligatoires doivent être remplis." }, { status: 400 });
    if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254)
      return NextResponse.json({ success: false, message: "Email invalide." }, { status: 400 });
    if (typeof password !== "string" || password.length < 8)
      return NextResponse.json({ success: false, message: "Mot de passe minimum 8 caractères." }, { status: 400 });
    if (typeof entreprise !== "string" || entreprise.trim().length < 2 || entreprise.length > 100)
      return NextResponse.json({ success: false, message: "Nom d'entreprise invalide." }, { status: 400 });
    if (typeof nom !== "string" || nom.trim().length < 2 || nom.length > 100)
      return NextResponse.json({ success: false, message: "Nom invalide." }, { status: 400 });
    if (boutiquesNoms !== undefined && (!Array.isArray(boutiquesNoms) || boutiquesNoms.length > 20 || boutiquesNoms.some((b: any) => typeof b !== "string" || b.length > 100)))
      return NextResponse.json({ success: false, message: "Liste de boutiques invalide." }, { status: 400 });

    // Email déjà utilisé ?
    const emailExist = await User.findOne({ email: email.toLowerCase() });
    if (emailExist)
      return NextResponse.json({ success: false, message: "Cet email est déjà associé à un compte." }, { status: 400 });

    // Générer un slug unique pour le tenant
    let slug = toSlug(entreprise);
    const slugExist = await Tenant.findOne({ slug });
    if (slugExist) slug = `${slug}-${Date.now().toString(36)}`;

    // Créer le tenant
    const tenant = await Tenant.create({
      nom: entreprise, slug, email: email.toLowerCase(),
      telephone: telephone || "",
      pays: pays || "CI",
      ville: ville || "",
      plan: "gratuit", statut: "actif",
      nbBoutiquesMax: 5, nbUsersMax: 10,
    });

    // Créer les boutiques pour ce tenant
    const boutiquesACreer: any[] = [];

    // Dépôt optionnel — seulement si l'utilisateur l'a demandé
    if (depotNom) {
      boutiquesACreer.push({
        tenantId: tenant._id,
        nom: depotNom,
        type: "depot", estPrincipale: false, actif: true,
      });
    }

    const nomsB = (boutiquesNoms as string[]).filter(Boolean);
    nomsB.forEach((nomB, i) => {
      boutiquesACreer.push({
        tenantId: tenant._id,
        nom: nomB, type: "boutique",
        estPrincipale: i === 0, actif: true,
      });
    });
    await Boutique.insertMany(boutiquesACreer);

    // Créer l'admin du tenant
    await User.create({
      tenantId: tenant._id,
      nom, email: email.toLowerCase(),
      password, // hashé par le pre-save hook
      role: "admin",
      boutique: null, actif: true,
    });

    return NextResponse.json({
      success: true,
      message: "Compte créé avec succès !",
      tenantSlug: tenant.slug,
    }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Cet email est déjà utilisé." }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
