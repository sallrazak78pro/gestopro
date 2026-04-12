// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Produit from "@/lib/models/Produit";
import Stock from "@/lib/models/Stock";
import Boutique from "@/lib/models/Boutique";
import SessionCaisse from "@/lib/models/SessionCaisse";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET() {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const notifications: Array<{
      id:       string;
      type:     "rupture" | "stock_faible" | "session_ouverte" | "commande_en_attente" | "commande_a_payer" | "versement_en_attente";
      titre:    string;
      message:  string;
      severity: "danger" | "warning" | "info";
      href:     string;
    }> = [];

    // ── Boutiques accessibles ──────────────────────────────────
    const boutiqueFilter = ctx.boutiqueAssignee
      ? [ctx.boutiqueAssignee]
      : (await Boutique.find({ tenantId: ctx.tenantId, actif: true })).map(b => b._id.toString());

    // ── 1. Alertes stock ───────────────────────────────────────
    const produits = await Produit.find({ tenantId: ctx.tenantId, actif: true });

    for (const p of produits) {
      const stocks   = await Stock.find({ produit: p._id, boutique: { $in: boutiqueFilter } });
      const totalQte = stocks.reduce((s, st) => s + st.quantite, 0);

      if (totalQte === 0) {
        notifications.push({
          id:       `rupture-${p._id}`,
          type:     "rupture",
          titre:    `Rupture : ${p.nom}`,
          message:  `Stock épuisé${p.reference ? ` (réf. ${p.reference})` : ""}`,
          severity: "danger",
          href:     `/stock/${p._id}`,
        });
      } else if (totalQte <= p.seuilAlerte) {
        notifications.push({
          id:       `alerte-${p._id}`,
          type:     "stock_faible",
          titre:    `Stock faible : ${p.nom}`,
          message:  `${totalQte} unité${totalQte > 1 ? "s" : ""} restante${totalQte > 1 ? "s" : ""} (seuil : ${p.seuilAlerte})`,
          severity: "warning",
          href:     `/stock/${p._id}`,
        });
      }
    }

    // ── 2. Sessions caisse ouvertes depuis > 24h ───────────────
    const hier = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sessionsQuery: any = { tenantId: ctx.tenantId, statut: "ouverte" };
    if (ctx.boutiqueAssignee) sessionsQuery.boutique = ctx.boutiqueAssignee;

    const sessionsOuvertes = await SessionCaisse.find(sessionsQuery)
      .populate("boutique", "nom");

    for (const s of sessionsOuvertes) {
      if (new Date(s.dateOuverture) < hier) {
        notifications.push({
          id:       `session-${s._id}`,
          type:     "session_ouverte",
          titre:    `Caisse non fermée`,
          message:  `La caisse "${(s.boutique as any)?.nom}" est ouverte depuis plus de 24h`,
          severity: "warning",
          href:     `/caisse/${s._id}`,
        });
      }
    }

    // ── 3. Commandes fournisseurs (admins seulement) ───────────
    if (["admin", "superadmin"].includes(ctx.role)) {
      // Commandes envoyées mais pas encore réceptionnées depuis > 3 jours
      const il_y_a_3j = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const commandesEnAttente = await CommandeFournisseur.find({
        tenantId: ctx.tenantId,
        statut:   "envoyee",
        dateCommande: { $lt: il_y_a_3j },
      }).populate("fournisseur", "nom");

      for (const c of commandesEnAttente) {
        notifications.push({
          id:       `commande-${c._id}`,
          type:     "commande_en_attente",
          titre:    `Livraison en attente`,
          message:  `Commande ${c.reference} chez ${(c.fournisseur as any)?.nom} non réceptionnée`,
          severity: "info",
          href:     `/commandes/${c._id}`,
        });
      }

      // Commandes reçues avec reste à payer
      const commandesAPayer = await CommandeFournisseur.find({
        tenantId:  ctx.tenantId,
        statut:    { $in: ["recue", "recue_partiellement"] },
        montantDu: { $gt: 0 },
      }).populate("fournisseur", "nom");

      for (const c of commandesAPayer) {
        notifications.push({
          id:       `paiement-${c._id}`,
          type:     "commande_a_payer",
          titre:    `Paiement dû`,
          message:  `${(c.fournisseur as any)?.nom} — ${new Intl.NumberFormat("fr-FR").format(c.montantDu)} F à régler`,
          severity: "warning",
          href:     `/commandes/${c._id}`,
        });
      }
    }

    // ── Versements en attente (admin uniquement) ────────────────
    if (["admin","superadmin"].includes(ctx.role)) {
      const nbVersements = await MouvementArgent.countDocuments({
        tenantId: ctx.tenantId,
        type:     "versement_boutique",
        statut:   "en_attente",
      });
      if (nbVersements > 0) {
        notifications.push({
          id:       "versements_attente",
          type:     "versement_en_attente",
          severity: "warning",
          titre:    `${nbVersements} versement${nbVersements > 1 ? "s" : ""} en attente`,
          message:  `${nbVersements} versement${nbVersements > 1 ? "s" : ""} de boutique${nbVersements > 1 ? "s" : ""} à confirmer`,
          href:     "/versements",
        });
      }
    }

    // ── Tri : danger en premier, puis warning, puis info ───────
    const ORDRE = { danger: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => ORDRE[a.severity] - ORDRE[b.severity]);

    return NextResponse.json({
      success: true,
      data:    notifications,
      stats: {
        total:   notifications.length,
        danger:  notifications.filter(n => n.severity === "danger").length,
        warning: notifications.filter(n => n.severity === "warning").length,
        info:    notifications.filter(n => n.severity === "info").length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
