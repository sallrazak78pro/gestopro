// app/api/parametres/permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import { getTenantContext } from "@/lib/utils/tenant";
import { MODULES, type Action, type ConfigurableRole } from "@/lib/utils/permissions";

const ROLES: ConfigurableRole[] = ["gestionnaire", "caissier"];

// PUT — enregistrer la matrice de permissions du tenant (admin/superadmin uniquement).
export async function PUT(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();

    const body = await req.json();
    const incoming = body?.permissions;
    if (!incoming || typeof incoming !== "object")
      return NextResponse.json({ success: false, message: "Format invalide." }, { status: 400 });

    // Ne reconstruire que des rôles/modules/actions connus — jamais stocker
    // du JSON arbitraire envoyé par le client.
    const sanitized: Record<string, Record<string, Partial<Record<Action, boolean>>>> = {};
    for (const role of ROLES) {
      sanitized[role] = {};
      const roleIn = incoming[role];
      if (!roleIn || typeof roleIn !== "object") continue;
      for (const mod of MODULES) {
        const modIn = roleIn[mod.key];
        if (!modIn || typeof modIn !== "object") continue;
        const cell: Partial<Record<Action, boolean>> = {};
        for (const action of mod.actions) {
          if (typeof modIn[action] === "boolean") cell[action] = modIn[action];
        }
        sanitized[role][mod.key] = cell;
      }
    }

    const tenant = await Tenant.findByIdAndUpdate(
      ctx.tenantId,
      { permissions: sanitized },
      { new: true }
    );
    return NextResponse.json({ success: true, data: tenant });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
