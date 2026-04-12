// app/api/utilisateurs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";

// GET — liste des utilisateurs du tenant
export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;

    // Seuls admin et superadmin peuvent gérer les utilisateurs
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const query: any = { tenantId: ctx.tenantId };
    if (search) query.$or = [
      { nom: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];

    const users = await User.find(query)
      .populate("boutique", "nom type")
      .select("-password") // ne jamais retourner le mot de passe
      .sort({ createdAt: -1 });

    // Stats
    const nbActifs   = users.filter(u => u.actif).length;
    const nbInactifs = users.filter(u => !u.actif).length;

    // Compter les boutiques disponibles pour l'assignation
    const boutiques = await Boutique.find({
      tenantId: ctx.tenantId, type: "boutique", actif: true
    }).sort({ nom: 1 });

    return NextResponse.json({
      success: true, data: users,
      stats: { total: users.length, nbActifs, nbInactifs },
      boutiques,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST — créer un utilisateur dans le tenant
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;

    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });

    await connectDB();
    const { nom, email, password, role, boutiqueId } = await req.json();

    if (!nom || !email || !password)
      return NextResponse.json({ success: false, message: "Nom, email et mot de passe sont obligatoires." }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ success: false, message: "Mot de passe minimum 6 caractères." }, { status: 400 });

    // Un admin ne peut pas créer un autre admin (seulement gestionnaire/caissier)
    if (ctx.role === "admin" && role === "admin")
      return NextResponse.json({ success: false, message: "Vous ne pouvez pas créer un autre administrateur." }, { status: 403 });

    // Email déjà utilisé ?
    const emailExist = await User.findOne({ email: email.toLowerCase() });
    if (emailExist)
      return NextResponse.json({ success: false, message: "Cet email est déjà utilisé." }, { status: 400 });

    // Vérifier la limite d'utilisateurs du tenant
    const tenant = await (await import("@/lib/models/Tenant")).default.findById(ctx.tenantId);
    const currentCount = await User.countDocuments({ tenantId: ctx.tenantId });
    if (tenant && currentCount >= tenant.nbUsersMax)
      return NextResponse.json({
        success: false,
        message: `Limite atteinte (${tenant.nbUsersMax} utilisateurs max sur votre plan).`,
      }, { status: 400 });

    const user = await User.create({
      tenantId: ctx.tenantId,
      nom, email: email.toLowerCase(),
      password,
      role: role || "caissier",
      boutique: boutiqueId || null,
      actif: true,
    });

    // Retourner sans le mot de passe
    const { password: _, ...userSafe } = user.toObject();
    return NextResponse.json({ success: true, data: userSafe }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Cet email est déjà utilisé." }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
