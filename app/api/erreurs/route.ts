// app/api/erreurs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import ErreurSignalee from "@/lib/models/ErreurSignalee";

// POST — signaler une erreur (tout utilisateur authentifié)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, message: "Non authentifié" }, { status: 401 });

    const user = session.user as any;
    const body = await req.json();

    if (!body.description?.trim())
      return NextResponse.json({ success: false, message: "Description requise" }, { status: 400 });

    await connectDB();
    const erreur = await ErreurSignalee.create({
      tenantId:    user.tenantId   ?? null,
      userId:      user.id,
      userNom:     user.name       ?? "Inconnu",
      userRole:    user.role       ?? "inconnu",
      userEmail:   user.email      ?? "",
      page:        body.page       || "/",
      type:        body.type       || "bug",
      description: body.description.trim(),
    });

    return NextResponse.json({ success: true, data: erreur }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// GET — super admin : toutes les erreurs / user : les siennes
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, message: "Non authentifié" }, { status: 401 });

    const user          = session.user as any;
    const isSuperAdmin  = user.role === "superadmin" && !user.tenantId;

    await connectDB();

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const type   = searchParams.get("type");

    const filter: any = isSuperAdmin ? {} : { userId: user.id };
    if (statut) filter.statut = statut;
    if (type)   filter.type   = type;

    const erreurs = await ErreurSignalee.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({ success: true, data: erreurs });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
