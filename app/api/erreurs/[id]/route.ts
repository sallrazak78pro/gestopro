// app/api/erreurs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import ErreurSignalee from "@/lib/models/ErreurSignalee";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, message: "Non authentifié" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "superadmin" || user.tenantId)
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    await connectDB();

    const update: any = {};
    if (body.statut)    update.statut    = body.statut;
    if (body.adminNote !== undefined) update.adminNote = body.adminNote;

    const erreur = await ErreurSignalee.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!erreur) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });

    return NextResponse.json({ success: true, data: erreur });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
