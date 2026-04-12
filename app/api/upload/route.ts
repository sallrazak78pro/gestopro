// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/utils/tenant";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;

    const formData = await req.formData();
    const file     = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ success: false, message: "Aucun fichier." }, { status: 400 });

    // Vérifications
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ success: false, message: "Fichier doit être une image." }, { status: 400 });

    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json({ success: false, message: "Image trop lourde (max 5 Mo)." }, { status: 400 });

    // Convertir en base64 pour Cloudinary
    const bytes  = await file.arrayBuffer();
    const base64 = `data:${file.type};base64,${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;

    // Upload sur Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder:         `gestopro/${ctx.tenantId}/produits`,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "auto" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    return NextResponse.json({ success: true, url: result.secure_url });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
