// app/api/sessions-caisse/dernier-solde/route.ts
// Retourne le montant réel de la dernière session fermée d'une boutique
// Ce montant devient le fond d'ouverture de la prochaine session (bloqué)
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SessionCaisse from "@/lib/models/SessionCaisse";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const boutiqueId = new URL(req.url).searchParams.get("boutiqueId");
    if (!boutiqueId)
      return NextResponse.json({ success: false, message: "boutiqueId requis" }, { status: 400 });

    // Trouver la dernière session FERMÉE de cette boutique
    const derniere = await SessionCaisse.findOne({
      tenantId: ctx.tenantId,
      boutique:  boutiqueId,
      statut:    "fermee",
    }).sort({ dateFermeture: -1 });

    if (!derniere) {
      // Aucune session précédente → fond libre à saisir
      return NextResponse.json({
        success: true,
        data: { fondSuggere: null, premiereFois: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        // Le fond suggéré = montant réel compté à la fermeture
        fondSuggere:   derniere.montantReelTotal,
        premiereFois:  false,
        dateFermeture: derniere.dateFermeture,
        reference:     derniere.reference ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
