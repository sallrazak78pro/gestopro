// app/(dashboard)/tiers/[id]/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  depot_tiers:    { label: "Dépôt",         icon: "📥", color: "text-success" },
  retrait_tiers:  { label: "Retrait",        icon: "📤", color: "text-danger"  },
  remboursement:  { label: "Remboursement",  icon: "↩️", color: "text-accent"  },
};

export default function TiersDetailPage() {
  const { id }    = useParams();
  const router    = useRouter();
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/tiers/${id}`);
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
      <p className="text-muted font-mono">Compte tiers introuvable</p>
      <button onClick={() => router.back()} className="btn-ghost btn-sm mt-4">← Retour</button>
    </div>
  );

  const { tiers: t, historique } = data;

  // Calculer totaux
  const totalDepots   = historique.filter((m: any) => m.type === "depot_tiers").reduce((s: number, m: any) => s + m.montant, 0);
  const totalRetraits = historique.filter((m: any) => m.type === "retrait_tiers").reduce((s: number, m: any) => s + m.montant, 0);
  const soldeReel     = totalDepots - totalRetraits;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost btn-sm">← Retour</button>
      </div>

      {/* Fiche tiers */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">👤</span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "var(--color-fg)" }}>
                  {t.nom}
                </h1>
                {t.telephone && (
                  <p className="text-sm font-mono text-muted mt-0.5">{t.telephone}</p>
                )}
              </div>
            </div>
            {t.boutique && (
              <p className="text-sm text-muted">Boutique : <span className="font-semibold" style={{ color: "var(--color-fg)" }}>{t.boutique.nom}</span></p>
            )}
            {t.description && (
              <p className="text-sm text-muted mt-2">{t.description}</p>
            )}
          </div>

          {/* Solde */}
          <div className={clsx(
            "rounded-2xl px-5 py-4 text-center border",
            t.solde > 0 ? "bg-danger/10 border-danger/20" : "bg-success/10 border-success/20"
          )}>
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
              {t.solde > 0 ? "Doit à l'entreprise" : "Solde équilibré"}
            </p>
            <p className={clsx("font-mono font-extrabold text-2xl", t.solde > 0 ? "text-danger" : "text-success")}>
              {fmt(Math.abs(t.solde))} F
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card">
          <span className="kpi-icon">📥</span>
          <p className="kpi-label">Total déposé</p>
          <p className="kpi-value text-success">{fmt(totalDepots)} F</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon">📤</span>
          <p className="kpi-label">Total retiré</p>
          <p className="kpi-value text-danger">{fmt(totalRetraits)} F</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon">📊</span>
          <p className="kpi-label">Transactions</p>
          <p className="kpi-value">{historique.length}</p>
        </div>
      </div>

      {/* Historique */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Historique des mouvements</h2>
          <span className="badge-blue">{historique.length} transaction{historique.length > 1 ? "s" : ""}</span>
        </div>

        {historique.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-muted font-mono text-sm">Aucun mouvement enregistré</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {historique.map((m: any) => {
              const tc = TYPE_CONFIG[m.type] ?? { label: m.type, icon: "💰", color: "" };
              return (
                <div key={m._id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0",
                    m.type === "depot_tiers"   ? "bg-success/10" :
                    m.type === "retrait_tiers" ? "bg-danger/10" : "bg-accent/10"
                  )}>
                    {tc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
                      {tc.label}
                    </p>
                    <p className="text-xs text-muted font-mono">
                      {m.boutique?.nom} ·{" "}
                      {new Date(m.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {m.motif && ` · ${m.motif}`}
                    </p>
                  </div>
                  <p className={clsx("font-mono font-bold text-sm shrink-0", tc.color)}>
                    {m.type === "retrait_tiers" ? "−" : "+"}{fmt(m.montant)} F
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Total en bas */}
        {historique.length > 0 && (
          <div className="px-5 py-4 border-t flex justify-between items-center" style={{ borderColor: "var(--color-border)" }}>
            <span className="text-sm font-mono text-muted">Solde calculé</span>
            <span className={clsx("font-mono font-extrabold", soldeReel > 0 ? "text-danger" : "text-success")}>
              {soldeReel >= 0 ? "+" : ""}{fmt(soldeReel)} F
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
