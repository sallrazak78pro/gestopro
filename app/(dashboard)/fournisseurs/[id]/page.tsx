// app/(dashboard)/fournisseurs/[id]/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import FournisseurModal from "@/components/fournisseurs/FournisseurModal";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const STATUT_CONFIG: Record<string, { label: string; badge: string }> = {
  brouillon:           { label: "Brouillon",  badge: "badge-orange" },
  envoyee:             { label: "Envoyée",    badge: "badge-blue"   },
  recue_partiellement: { label: "Partielle",  badge: "badge-orange" },
  recue:               { label: "Reçue",      badge: "badge-green"  },
  annulee:             { label: "Annulée",    badge: "badge-red"    },
};

export default function FournisseurDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/fournisseurs/${id}`);
    const json = await res.json();
    if (json.success) setData(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-muted font-mono text-sm">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Chargement...
    </div>
  );
  if (!data) return (
    <div className="text-center py-20">
      <p className="text-muted font-mono">Fournisseur introuvable</p>
      <button onClick={() => router.back()} className="btn-ghost btn-sm mt-4">← Retour</button>
    </div>
  );

  const { fournisseur: f, commandes, stats } = data;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost btn-sm">← Retour</button>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowEdit(true)} className="btn-ghost btn-sm">✏️ Modifier</button>
          <Link href="/commandes" className="btn-primary btn-sm">+ Nouvelle commande</Link>
        </div>
      </div>

      {/* Fiche fournisseur */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🏭</span>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-fg)" }}>
                {f.nom}
              </h1>
              {!f.actif && <span className="badge-red">Inactif</span>}
            </div>
            {f.contact && (
              <p className="text-sm font-mono text-muted">Contact : {f.contact}</p>
            )}
          </div>
          <div className="text-right">
            {f.soldeCredit > 0 && (
              <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Solde dû</p>
                <p className="font-mono font-extrabold text-danger text-xl">{fmt(f.soldeCredit)} F</p>
              </div>
            )}
          </div>
        </div>

        {/* Infos de contact */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {f.telephone && (
            <div className="bg-surface2 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Téléphone</p>
              <p className="text-sm font-semibold">{f.telephone}</p>
            </div>
          )}
          {f.email && (
            <div className="bg-surface2 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Email</p>
              <p className="text-sm font-semibold truncate">{f.email}</p>
            </div>
          )}
          {f.adresse && (
            <div className="bg-surface2 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Adresse</p>
              <p className="text-sm font-semibold">{f.adresse}</p>
            </div>
          )}
        </div>

        {f.notes && (
          <div className="mt-4 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
            <p className="text-xs font-mono text-muted mb-1">Notes</p>
            <p className="text-sm">{f.notes}</p>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Commandes",       value: stats.totalCommandes, icon: "🛒", color: "" },
          { label: "Total achats",    value: fmt(stats.totalAchats) + " F", icon: "💰", color: "" },
          { label: "Reste à payer",   value: fmt(stats.totalDu) + " F", icon: "💳",
            color: stats.totalDu > 0 ? "text-danger" : "text-success" },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <span className="kpi-icon">{k.icon}</span>
            <p className="kpi-label">{k.label}</p>
            <p className={clsx("kpi-value", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Historique commandes */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Historique des commandes</h2>
          <span className="badge-blue">{commandes.length} commande{commandes.length > 1 ? "s" : ""}</span>
        </div>

        {commandes.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-3xl">🛒</p>
            <p className="text-muted font-mono text-sm">Aucune commande pour ce fournisseur</p>
            <Link href="/commandes" className="btn-primary btn-sm inline-flex">Créer une commande</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Destination</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Payé</th>
                  <th className="text-right">Reste dû</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c: any) => {
                  const sc = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.brouillon;
                  return (
                    <tr key={c._id}>
                      <td className="font-mono text-xs text-accent">{c.reference}</td>
                      <td className="text-sm">{c.destination?.nom ?? "—"}</td>
                      <td className="font-mono text-xs text-muted">
                        {new Date(c.dateCommande).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="font-mono text-sm text-right">{fmt(c.montantTotal)} F</td>
                      <td className="font-mono text-sm text-right text-success">{fmt(c.montantPaye)} F</td>
                      <td className={clsx("font-mono text-sm font-bold text-right",
                        c.montantDu > 0 ? "text-danger" : "text-muted")}>
                        {c.montantDu > 0 ? fmt(c.montantDu) + " F" : "✓"}
                      </td>
                      <td><span className={sc.badge}>{sc.label}</span></td>
                      <td>
                        <Link href={`/commandes/${c._id}`} className="btn-ghost btn-sm">Voir →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEdit && (
        <FournisseurModal
          fournisseur={f}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); fetchData(); }}
        />
      )}
    </div>
  );
}
