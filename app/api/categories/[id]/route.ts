// app/api/categories/[id]/route.ts
// Suppression d'une catégorie via son ID dans l'URL (plus fiable que body sur DELETE)
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Catalogue from "@/lib/models/Catalogue";
import { getTenantContext } from "@/lib/utils/tenant";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    await Catalogue.findOneAndUpdate(
      { _id: (await params).id, tenantId: ctx.tenantId },
      { actif: false }
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
