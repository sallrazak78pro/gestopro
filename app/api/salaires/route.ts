// app/api/salaires/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import PaiementSalaire from "@/lib/models/PaiementSalaire";
import AvanceSalaire from "@/lib/models/AvanceSalaire";
import Employe from "@/lib/models/Employe";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

const MOIS_NOM = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    if (searchParams.get("mois"))   query.mois   = parseInt(searchParams.get("mois")!);
    if (searchParams.get("annee"))  query.annee  = parseInt(searchParams.get("annee")!);
    if (searchParams.get("employe")) query.employe = searchParams.get("employe");
    if (ctx.boutiqueAssignee) query.boutique = ctx.boutiqueAssignee;
    else if (searchParams.get("boutique")) query.boutique = searchParams.get("boutique");

    const paiements = await PaiementSalaire.find(query)
      .populate("employe", "nom prenom poste salaireBase")
      .populate("boutique", "nom")
      .populate("boutiqueSource", "nom")
      .populate("createdBy", "nom")
      .sort({ annee: -1, mois: -1, createdAt: -1 });

    const totalPaye = paiements.reduce((s, p) => s + p.montantNet, 0);
    return NextResponse.json({ success: true, data: paiements, stats: { totalPaye, nb: paiements.length } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();

    const { employeId, mois, annee, boutiqueSourceId, modePaiement, note } = await req.json();
    if (!employeId || !mois || !annee || !boutiqueSourceId)
      return NextResponse.json({ success: false, message: "Données manquantes." }, { status: 400 });

    // Vérifier que le salaire n'est pas déjà payé pour ce mois
    const dejaPayé = await PaiementSalaire.findOne({ employe: employeId, mois, annee, tenantId: ctx.tenantId });
    if (dejaPayé)
      return NextResponse.json({
        success: false,
        message: `Salaire de ${MOIS_NOM[mois]} ${annee} déjà payé pour cet employé.`,
      }, { status: 400 });

    const employe = await Employe.findOne({ _id: employeId, tenantId: ctx.tenantId });
    if (!employe)
      return NextResponse.json({ success: false, message: "Employé introuvable." }, { status: 404 });

    // Récupérer toutes les avances en attente pour ce mois de déduction
    const avancesADeduire = await AvanceSalaire.find({
      employe: employeId, tenantId: ctx.tenantId,
      moisDeduction: mois, anneeDeduction: annee,
      statut: "en_attente",
    });

    const totalAvances = avancesADeduire.reduce((s, a) => s + a.montant, 0);
    const montantNet   = Math.max(0, employe.salaireBase - totalAvances);

    // Générer la référence
    const count     = await PaiementSalaire.countDocuments({ tenantId: ctx.tenantId });
    const reference = `SAL-${annee}-${String(mois).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;

    // Créer le mouvement de trésorerie (sortie d'argent)
    const countMvt  = await MouvementArgent.countDocuments({ tenantId: ctx.tenantId });
    const refMvt    = `DEP-${new Date().getFullYear()}-${String(countMvt + 1).padStart(4, "0")}`;
    const mouvement = await MouvementArgent.create({
      tenantId: ctx.tenantId,
      reference: refMvt,
      type: "depense",
      boutique: boutiqueSourceId,
      montant: montantNet,
      categorieDepense: "salaire",
      motif: `Salaire ${MOIS_NOM[mois]} ${annee} — ${employe.prenom} ${employe.nom}`,
      createdBy: ctx.userId,
    });

    // Créer le paiement de salaire
    const paiement = await PaiementSalaire.create({
      tenantId: ctx.tenantId,
      employe: employeId,
      boutique: employe.boutique,
      mois, annee,
      salaireBase:  employe.salaireBase,
      totalAvances,
      montantNet,
      avancesDeduits: avancesADeduire.map(a => a._id),
      datePaiement: new Date(),
      modePaiement: modePaiement || "especes",
      boutiqueSource: boutiqueSourceId,
      note: note || "",
      mouvementArgentId: mouvement._id,
      createdBy: ctx.userId,
      reference,
    });

    // Marquer les avances comme déduites
    if (avancesADeduire.length > 0) {
      await AvanceSalaire.updateMany(
        { _id: { $in: avancesADeduire.map(a => a._id) } },
        { statut: "deduite", paiementSalaireId: paiement._id }
      );
    }

    const populated = await PaiementSalaire.findById(paiement._id)
      .populate("employe", "nom prenom poste")
      .populate("boutiqueSource", "nom")
      .populate("createdBy", "nom");

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Salaire déjà enregistré pour ce mois." }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
