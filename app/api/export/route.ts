// app/api/export/route.ts — Export CSV universel
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext, requirePermission } from "@/lib/utils/tenant";
import { hasPermission } from "@/lib/utils/permissions";
import { limiterPeriode } from "@/lib/utils/periodeStats";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import MouvementStock from "@/lib/models/MouvementStock";
import Employe, { SANS_COMPTE_UTILISATEUR } from "@/lib/models/Employe";
import Produit from "@/lib/models/Produit";
import Stock from "@/lib/models/Stock";

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines   = [headers.map(escape).join(",")];
  rows.forEach(row => lines.push(row.map(escape).join(",")));
  return "\uFEFF" + lines.join("\r\n"); // BOM UTF-8 pour Excel
}

function fmtDate(d: any) {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtNum(n: number) { return String(Math.round(n)); }

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const type  = searchParams.get("type") || "ventes";
    const debut = searchParams.get("debut") ? new Date(searchParams.get("debut")! + "T00:00:00") : null;
    const fin   = searchParams.get("fin")   ? new Date(searchParams.get("fin")!   + "T23:59:59") : null;

    // Un export donne les mêmes données que la page correspondante : il exige
    // le même droit de lecture, sinon il suffisait de l'appeler pour tout voir.
    const MODULE_PAR_TYPE: Record<string, string> = {
      ventes: "ventes", tresorerie: "tresorerie", stock: "stock",
      "mouvements-stock": "mouvements", employes: "employes",
    };
    const moduleRequis = MODULE_PAR_TYPE[type];
    if (!moduleRequis)
      return NextResponse.json({ success: false, message: "Type d'export inconnu." }, { status: 400 });
    const denied = requirePermission(ctx, moduleRequis, "view");
    if (denied) return denied;

    const boutiqueFilter = ctx.boutiqueAssignee ? { boutique: ctx.boutiqueAssignee } : {};
    // Même période autorisée que les pages de statistiques — sans quoi l'export
    // permettrait de récupérer tout l'historique malgré la limite.
    const dateFilter: Record<string, any> = debut && fin ? { createdAt: { $gte: debut, $lte: fin } } : {};
    limiterPeriode(ctx, dateFilter);

    let csv = "";
    let filename = "export";

    if (type === "ventes") {
      const ventes = await Vente.find({ tenantId: ctx.tenantId, ...boutiqueFilter, ...dateFilter })
        .populate("boutique", "nom").sort({ createdAt: -1 }).lean();

      const rows = ventes.flatMap((v: any) =>
        v.lignes.map((l: any) => [
          v.reference,
          fmtDate(v.createdAt),
          v.boutique?.nom ?? "",
          v.client ?? "Client comptoir",
          v.employeNom ?? "",
          l.nomProduit,
          fmtNum(l.quantite),
          fmtNum(l.prixUnitaire),
          fmtNum(l.sousTotal),
          fmtNum(v.montantTotal),
          v.modePaiement ?? "",
          v.statut,
        ])
      );

      csv = toCSV(
        ["Référence","Date","Boutique","Client","Employé","Produit","Qté","Prix unit. (F)","Sous-total (F)","Total (F)","Paiement","Statut"],
        rows
      );
      filename = "ventes";

    } else if (type === "tresorerie") {
      const mouvs = await MouvementArgent.find({ tenantId: ctx.tenantId, ...boutiqueFilter, ...dateFilter })
        .populate("boutique", "nom").sort({ createdAt: -1 }).lean();

      const rows = mouvs.map((m: any) => [
        m.reference ?? "",
        fmtDate(m.createdAt),
        m.type,
        m.boutique?.nom ?? "",
        fmtNum(m.montant),
        m.motif ?? "",
        m.categorieDepense ?? "",
      ]);

      csv = toCSV(
        ["Référence","Date","Type","Boutique","Montant (F)","Motif","Catégorie"],
        rows
      );
      filename = "tresorerie";

    } else if (type === "stock") {
      const produits = await Produit.find({ tenantId: ctx.tenantId, actif: true }, "-image").lean();
      const stocksTous = await Stock.find({ tenantId: ctx.tenantId })
        .populate("boutique", "nom").lean() as any[];
      const stocksParProduit = new Map<string, any[]>();
      stocksTous.forEach(s => {
        const key = s.produit.toString();
        if (!stocksParProduit.has(key)) stocksParProduit.set(key, []);
        stocksParProduit.get(key)!.push(s);
      });
      const rows: string[][] = [];

      for (const p of produits) {
        const stocks = stocksParProduit.get((p as any)._id.toString()) ?? [];

        if (stocks.length === 0) {
          rows.push([
            (p as any).reference, (p as any).nom, (p as any).categorie,
            fmtNum((p as any).prixAchat), fmtNum((p as any).prixVente),
            "—", "0", fmtNum((p as any).seuilAlerte),
          ]);
        } else {
          stocks.forEach((s: any) => {
            rows.push([
              (p as any).reference, (p as any).nom, (p as any).categorie,
              fmtNum((p as any).prixAchat), fmtNum((p as any).prixVente),
              s.boutique?.nom ?? "", fmtNum(s.quantite), fmtNum((p as any).seuilAlerte),
            ]);
          });
        }
      }

      csv = toCSV(
        ["Référence","Nom","Catégorie","Prix achat (F)","Prix vente (F)","Boutique","Stock","Seuil alerte"],
        rows
      );
      filename = "stock";

    } else if (type === "mouvements-stock") {
      const mouvs = await MouvementStock.find({ tenantId: ctx.tenantId, ...boutiqueFilter, ...dateFilter })
        .populate("boutique", "nom").populate("lignes.produit", "nom")
        .populate("createdBy", "nom prenom").sort({ createdAt: -1 }).lean();

      const rows = mouvs.flatMap((m: any) =>
        m.lignes.map((l: any) => [
          m.reference ?? "",
          fmtDate(m.createdAt),
          m.type === "entree" ? "Entrée" : "Sortie",
          m.boutique?.nom ?? "",
          l.produit?.nom ?? "",
          fmtNum(l.quantite),
          fmtNum(l.montant),
          m.motif ?? "",
          m.createdBy ? `${m.createdBy.prenom} ${m.createdBy.nom}` : "",
        ])
      );

      csv = toCSV(
        ["Référence","Date","Type","Boutique","Produit","Qté","Montant (F)","Motif","Créé par"],
        rows
      );
      filename = "mouvements-stock";

    } else if (type === "employes") {
      const employes = await Employe.find({ tenantId: ctx.tenantId, ...boutiqueFilter, ...SANS_COMPTE_UTILISATEUR })
        .populate("boutique", "nom").lean();

      // Le salaire est une donnée de paie : colonne incluse seulement pour qui
      // a accès au module Salaires (l'admin, ou un rôle explicitement autorisé).
      const voitSalaires = hasPermission(ctx.role, ctx.tenantPermissions, "salaires", "view");

      const rows = employes.map((e: any) => [
        e.nom, e.prenom, e.poste ?? "",
        e.boutique?.nom ?? "",
        ...(voitSalaires ? [fmtNum(e.salaireBase)] : []),
        e.telephone ?? "",
        e.actif ? "Actif" : "Inactif",
        fmtDate(e.createdAt),
      ]);

      csv = toCSV(
        ["Nom","Prénom","Poste","Boutique",
          ...(voitSalaires ? ["Salaire (F)"] : []),
          "Téléphone","Statut","Date embauche"],
        rows
      );
      filename = "employes";
    }

    if (!csv) {
      return NextResponse.json({ success: false, message: "Type d'export inconnu." }, { status: 400 });
    }

    const dateStr = new Date().toISOString().split("T")[0];
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}-${dateStr}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
