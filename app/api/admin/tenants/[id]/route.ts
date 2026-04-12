// app/api/admin/tenants/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import User from "@/lib/models/User";
import Boutique from "@/lib/models/Boutique";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getSuperAdminContext } from "@/lib/utils/tenant";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, error } = await getSuperAdminContext();
    if (error) return error;

    await connectDB();
    const body = await req.json();
    const allowed = ["statut", "plan", "nbBoutiquesMax", "nbUsersMax", "dateExpiration"];
    const update: any = {};
    allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });

    const tenant = await Tenant.findByIdAndUpdate(id, update, { new: true });
    if (!tenant)
      return NextResponse.json({ success: false, message: "Tenant introuvable" }, { status: 404 });

    return NextResponse.json({ success: true, data: tenant });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, error } = await getSuperAdminContext();
    if (error) return error;

    await connectDB();
    const tenantId = id;

    // Supprimer toutes les données du tenant en parallèle
    await Promise.all([
      User.deleteMany({ tenantId }),
      Boutique.deleteMany({ tenantId }),
      Vente.deleteMany({ tenantId }),
      MouvementArgent.deleteMany({ tenantId }),
      Tenant.findByIdAndDelete(tenantId),
    ]);

    return NextResponse.json({ success: true, message: "Entreprise supprimée." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
