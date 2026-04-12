// app/api/export/route.ts — Export CSV universel
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext } from "@/lib/utils/tenant";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import MouvementStock from "@/lib/models/MouvementStock";
import Employe from "@/lib/models/Employe";
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

    const boutiqueFilter = ctx.boutiqueAssignee ? { boutique: ctx.boutiqueAssignee } : {};
    const dateFilter = debut && fin ? { createdAt: { $gte: debut, $lte: fin } } : {};

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
      const mouvs = await MouvementArgent.find({ tenantId: ctx.tenantId, ...dateFilter })
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
      const produits = await Produit.find({ tenantId: ctx.tenantId, actif: true }).lean();
      const rows: string[][] = [];

      for (const p of produits) {
        const stocks = await Stock.find({ produit: p._id, tenantId: ctx.tenantId })
          .populate("boutique", "nom").lean() as any[];

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
      const mouvs = await MouvementStock.find({ tenantId: ctx.tenantId, ...dateFilter })
        .populate("source", "nom").populate("destination", "nom")
        .populate("createdBy", "nom prenom").sort({ createdAt: -1 }).lean();

      const rows = mouvs.map((m: any) => [
        m.reference ?? "",
        fmtDate(m.createdAt),
        m.type,
        m.source?.nom ?? "—",
        m.destination?.nom ?? "—",
        m.produitNom ?? "",
        fmtNum(m.quantite),
        m.motif ?? "",
        m.statut ?? "",
        m.createdBy ? `${m.createdBy.prenom} ${m.createdBy.nom}` : "",
      ]);

      csv = toCSV(
        ["Référence","Date","Type","Source","Destination","Produit","Qté","Motif","Statut","Créé par"],
        rows
      );
      filename = "mouvements-stock";

    } else if (type === "employes") {
      const employes = await Employe.find({ tenantId: ctx.tenantId, ...boutiqueFilter })
        .populate("boutique", "nom").lean();

      const rows = employes.map((e: any) => [
        e.nom, e.prenom, e.poste ?? "",
        e.boutique?.nom ?? "",
        fmtNum(e.salaireBase),
        e.telephone ?? "",
        e.actif ? "Actif" : "Inactif",
        fmtDate(e.createdAt),
      ]);

      csv = toCSV(
        ["Nom","Prénom","Poste","Boutique","Salaire (F)","Téléphone","Statut","Date embauche"],
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
