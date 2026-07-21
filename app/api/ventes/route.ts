// app/api/ventes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vente from "@/lib/models/Vente";
import Stock from "@/lib/models/Stock";
import Produit from "@/lib/models/Produit";
import Employe from "@/lib/models/Employe";
import { getTenantContext, canAccessBoutique } from "@/lib/utils/tenant";
import SessionCaisse from "@/lib/models/SessionCaisse";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";
import { genererReference } from "@/lib/utils/reference";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };

    // Restriction par boutique assignée
    if (ctx.boutiqueAssignee) {
      query.boutique = ctx.boutiqueAssignee;
    } else if (searchParams.get("boutique")) {
      query.boutique = searchParams.get("boutique");
    }

    if (searchParams.get("statut")) query.statut = searchParams.get("statut");
    if (searchParams.get("search")) {
      const s = searchParams.get("search");
      query.$or = [{ reference: { $regex: s, $options: "i" } }, { client: { $regex: s, $options: "i" } }];
    }
    const debut = searchParams.get("debut"), fin = searchParams.get("fin");
    if (debut || fin) {
      query.createdAt = {};
      if (debut) query.createdAt.$gte = new Date(debut);
      if (fin)   query.createdAt.$lte = new Date(fin + "T23:59:59");
    }

    const page  = parseInt(searchParams.get("page")  || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip  = (page - 1) * limit;

    const [ventes, total] = await Promise.all([
      Vente.find(query)
        .populate("boutique", "nom")
        .populate("employe",  "nom prenom")
        .populate("createdBy","nom")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vente.countDocuments(query),
    ]);

    const totalCA = ventes.filter(v => v.statut === "payee").reduce((s, v) => s + v.montantTotal, 0);
    return NextResponse.json({
      success: true, data: ventes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        totalCA, total: ventes.length,
        nbPayees:  ventes.filter(v => v.statut === "payee").length,
        nbAttente: ventes.filter(v => v.statut === "en_attente").length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { boutiqueId, client, lignes, modePaiement, montantRecu, note, statut, employeId } = await req.json();

    if (!lignes?.length)
      return NextResponse.json({ success: false, message: "Aucun article" }, { status: 400 });

    // Vérifier que l'utilisateur a accès à cette boutique
    if (!canAccessBoutique(ctx, boutiqueId)) {
      return NextResponse.json({
        success: false,
        message: "Vous n'avez pas accès à cette boutique.",
      }, { status: 403 });
    }

    // ── Vérifier qu'une session de caisse est ouverte ────────
    const sessionOuverte = await SessionCaisse.findOne({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      statut: "ouverte",
    });

    if (!sessionOuverte) {
      return NextResponse.json({
        success: false,
        message: "Aucune session de caisse ouverte pour cette boutique. Ouvrez la caisse avant de vendre.",
        code: "NO_SESSION",
      }, { status: 400 });
    }

    // Récupérer l'employé (celui qui effectue la vente) — un employé n'a pas
    // forcément de compte de connexion, "employe" pointe donc vers la fiche
    // Employe (pas vers un User, qui n'existe que pour ceux ayant un login).
    if (!employeId)
      return NextResponse.json({ success: false, message: "Employé requis." }, { status: 400 });
    const employe = await Employe.findOne({ _id: employeId, tenantId: ctx.tenantId });
    if (!employe)
      return NextResponse.json({ success: false, message: "Employé introuvable." }, { status: 404 });

    // Vérifier le stock (uniquement pour les produits avec suivi de stock activé)
    const produits = await Produit.find(
      { _id: { $in: lignes.map((l: any) => l.produitId) }, tenantId: ctx.tenantId },
      "suiviStock"
    ).lean();
    const suiviMap: Record<string, boolean> = {};
    produits.forEach((p: any) => { suiviMap[p._id.toString()] = p.suiviStock ?? true; });

    for (const ligne of lignes) {
      if (!suiviMap[ligne.produitId]) continue; // suivi de stock désactivé pour ce produit
      const stock = await Stock.findOne({ produit: ligne.produitId, boutique: boutiqueId, tenantId: ctx.tenantId });
      if (!stock || stock.quantite < ligne.quantite)
        return NextResponse.json({
          success: false,
          message: `Stock insuffisant : ${ligne.nomProduit} (dispo: ${stock?.quantite ?? 0})`,
        }, { status: 400 });
    }

    const montantTotal = lignes.reduce((s: number, l: any) => s + l.sousTotal, 0);
    const reference    = await genererReference(ctx.tenantId, `FCT-${new Date().getFullYear()}`);

    const vente = await Vente.create({
      tenantId: ctx.tenantId,
      reference,
      boutique: boutiqueId,
      client: client || "Client comptoir",
      employe: employe._id,
      employeNom: `${employe.prenom} ${employe.nom}`.trim(),
      lignes: lignes.map((l: any) => ({
        produit: l.produitId, nomProduit: l.nomProduit,
        quantite: l.quantite, prixUnitaire: l.prixUnitaire, sousTotal: l.sousTotal,
      })),
      montantTotal,
      montantRecu: montantRecu || montantTotal,
      monnaie: (montantRecu || montantTotal) - montantTotal,
      statut: statut || "payee",
      modePaiement: modePaiement || "especes",
      note: note || "",
      createdBy: ctx.userId,
    });

    if (vente.statut === "payee") {
      for (const ligne of lignes) {
        if (!suiviMap[ligne.produitId]) continue; // suivi de stock désactivé pour ce produit
        await Stock.findOneAndUpdate(
          { produit: ligne.produitId, boutique: boutiqueId, tenantId: ctx.tenantId },
          { $inc: { quantite: -ligne.quantite } }
        );
      }
    }

    // Log d'activité
    await logActivity({
      tenantId: ctx.tenantId, userId: ctx.userId,
      userNom: employe.nom ?? "", role: ctx.role,
      action: ACTIONS.VENTE_CREEE, module: MODULES.VENTES,
      details: `Vente ${reference} — ${new Intl.NumberFormat("fr-FR").format(montantTotal)} F — ${client || "Client comptoir"}`,
      reference, boutique: boutiqueId,
    });

    return NextResponse.json({ success: true, data: vente }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
