// app/api/employes/[id]/avances/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AvanceSalaire from "@/lib/models/AvanceSalaire";
import Employe from "@/lib/models/Employe";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext, canAccessBoutique, requirePermission } from "@/lib/utils/tenant";
import { genererReference } from "@/lib/utils/reference";
import { calculerSoldeCaisse } from "@/lib/utils/tresorerie";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";
import { arrondirFCFA } from "@/lib/utils/devise";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "employes", "view");
    if (denied) return denied;
    await connectDB();
    const avances = await AvanceSalaire.find({ employe: id, tenantId: ctx.tenantId })
      .populate("createdBy", "nom")
      .sort({ date: -1 });
    return NextResponse.json({ success: true, data: avances });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    // Repli sur le même droit que la modification d'un employé — voir
    // lib/utils/permissions.ts (une seule case "modifier" par module).
    const denied = requirePermission(ctx, "employes", "edit");
    if (denied) return denied;
    await connectDB();

    const { montant, motif, moisDeduction, anneeDeduction, boutiqueId } = await req.json();
    if (!montant || montant <= 0)
      return NextResponse.json({ success: false, message: "Montant invalide." }, { status: 400 });
    // Avance remise en espèces : multiple de 5 F (cf. lib/utils/devise.ts).
    const montantArrondi = arrondirFCFA(montant);

    const employe = await Employe.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!employe)
      return NextResponse.json({ success: false, message: "Employé introuvable." }, { status: 404 });

    const boutiqueSource = boutiqueId || employe.boutique?.toString();
    if (!canAccessBoutique(ctx, boutiqueSource))
      return NextResponse.json({ success: false, message: "Accès refusé à cette boutique." }, { status: 403 });

    // Une avance retire physiquement de l'argent de la caisse de la boutique
    // source — on ne peut pas avancer plus que ce qui y est disponible.
    const { soldeCaisse } = await calculerSoldeCaisse(ctx.tenantId, boutiqueSource);
    if (montantArrondi > soldeCaisse)
      return NextResponse.json({
        success: false,
        message: `Solde insuffisant. Disponible en caisse : ${new Intl.NumberFormat("fr-FR").format(soldeCaisse)} F.`,
      }, { status: 400 });

    // Créer l'avance
    const avance = await AvanceSalaire.create({
      tenantId: ctx.tenantId,
      employe: id,
      boutique: boutiqueId || employe.boutique,
      montant: montantArrondi, motif: motif || "",
      date: new Date(),
      moisDeduction, anneeDeduction,
      statut: "en_attente",
      createdBy: ctx.userId,
    });

    // Créer une sortie de trésorerie automatiquement
    const reference = await genererReference(ctx.tenantId, `AVS-${new Date().getFullYear()}`);
    await MouvementArgent.create({
      tenantId: ctx.tenantId,
      reference,
      type: "depense",
      boutique: boutiqueId || employe.boutique,
      montant: montantArrondi,
      categorieDepense: "salaire",
      motif: `Avance sur salaire — ${employe.prenom} ${employe.nom}${motif ? ` — ${motif}` : ""}`,
      createdBy: ctx.userId,
    });

    await logActivity({
      tenantId: ctx.tenantId, userId: ctx.userId, userNom: ctx.userNom, role: ctx.role,
      action: ACTIONS.AVANCE_CREEE, module: MODULES.EMPLOYES,
      details: `Avance sur salaire — ${employe.prenom} ${employe.nom} — ${new Intl.NumberFormat("fr-FR").format(montantArrondi)} F`,
      reference, boutique: (boutiqueId || employe.boutique)?.toString(),
    });

    return NextResponse.json({ success: true, data: avance }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
