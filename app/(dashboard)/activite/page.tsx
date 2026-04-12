// app/(dashboard)/activite/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

const fmt = (d: any) => new Date(d).toLocaleString("fr-FR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

const MODULES = [
  { value: "", label: "Tous les modules" },
  { value: "ventes",      label: "🧾 Ventes" },
  { value: "caisse",      label: "🏧 Caisse" },
  { value: "stock",       label: "📦 Stock" },
  { value: "tresorerie",  label: "💳 Trésorerie" },
  { value: "employes",    label: "👷 Employés" },
  { value: "utilisateurs",label: "👤 Utilisateurs" },
];

const ACTION_COLORS: Record<string, string> = {
  vente_creee:    "text-success bg-success/10 border-success/20",
  vente_annulee:  "text-danger  bg-danger/10  border-danger/20",
  vente_encaissee:"text-success bg-success/10 border-success/20",
  caisse_ouverte: "text-accent  bg-accent/10  border-accent/20",
  caisse_fermee:  "text-muted2  bg-surface2   border-border",
  stock_ajuste:   "text-warning bg-warning/10 border-warning/20",
  produit_cree:   "text-accent  bg-accent/10  border-accent/20",
  produit_supprime:"text-danger bg-danger/10  border-danger/20",
  mouvement_cree: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  connexion:      "text-muted2  bg-surface2   border-border",
};

export default function ActivitePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role ?? "";

  const [logs,    setLogs]    = useState<any[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [module,  setModule]  = useState("");
  const [debut,   setDebut]   = useState("");
  const [fin,     setFin]     = useState("");

  // Réserver aux admins
  useEffect(() => {
    if (session && !["admin", "superadmin"].includes(role)) {
      router.replace("/dashboard");
    }
  }, [session, role, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (module) params.set("module", module);
    if (debut)  params.set("debut", debut);
    if (fin)    params.set("fin",   fin);
    const res  = await fetch(`/api/activite?${params}`);
    const json = await res.json();
    if (json.success) {
      setLogs(json.data);
      setTotal(json.pagination.total);
      setPages(json.pagination.pages);
    }
    setLoading(false);
  }, [page, module, debut, fin]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-fg)" }}>
          📋 Journal d'activité
        </h1>
        <p className="text-sm text-muted mt-1">{total} action{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}</p>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <select className="select w-48" value={module} onChange={e => { setModule(e.target.value); setPage(1); }}>
          {MODULES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input type="date" className="input py-1.5 text-xs font-mono w-36"
          value={debut} onChange={e => { setDebut(e.target.value); setPage(1); }} />
        <span className="text-muted text-xs">→</span>
        <input type="date" className="input py-1.5 text-xs font-mono w-36"
          value={fin} onChange={e => { setFin(e.target.value); setPage(1); }} />
        <button onClick={fetchLogs} className="btn-ghost btn-sm">🔄</button>
        {(module || debut || fin) && (
          <button onClick={() => { setModule(""); setDebut(""); setFin(""); setPage(1); }}
            className="btn-ghost btn-sm text-danger">✕ Effacer</button>
        )}
      </div>

      {/* Liste */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-muted font-mono text-sm">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Chargement...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-muted font-mono text-sm">Aucune activité enregistrée</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {logs.map((log: any) => (
              <div key={log._id} className="flex items-start gap-4 px-5 py-3.5">
                {/* Icône module */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: "var(--color-surface2)" }}>
                  {log.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={clsx(
                      "text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border",
                      ACTION_COLORS[log.action] ?? "text-muted2 bg-surface2 border-border"
                    )}>
                      {log.actionLabel}
                    </span>
                    {log.reference && (
                      <span className="text-[11px] font-mono text-accent">{log.reference}</span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "var(--color-fg2)" }}>{log.details}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] font-mono text-muted font-semibold">{log.userNom}</span>
                    {log.role && (
                      <span className="text-[10px] font-mono text-muted uppercase">{log.role}</span>
                    )}
                    {log.boutique?.nom && (
                      <span className="text-[11px] font-mono text-muted">📍 {log.boutique.nom}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-mono text-muted">{fmt(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t"
            style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs font-mono text-muted">Page {page} / {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-ghost btn-sm disabled:opacity-40">← Précédent</button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="btn-ghost btn-sm disabled:opacity-40">Suivant →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
