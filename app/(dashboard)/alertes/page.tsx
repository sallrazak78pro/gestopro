// app/(dashboard)/alertes/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";

type Notif = {
  id:       string;
  type:     string;
  titre:    string;
  message:  string;
  severity: "danger" | "warning" | "info";
  href:     string;
};

const SEV_CONFIG = {
  danger:  { label: "Critique",     bg: "bg-danger/10",  border: "border-danger/30",  text: "text-danger",  dot: "bg-danger",  badge: "badge-red"   },
  warning: { label: "Avertissement",bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", dot: "bg-warning", badge: "badge-orange" },
  info:    { label: "Information",  bg: "bg-accent/10",  border: "border-accent/30",  text: "text-accent",  dot: "bg-accent",  badge: "badge-blue"  },
};

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  rupture:             { icon: "📭", label: "Rupture de stock" },
  stock_faible:        { icon: "⚠️", label: "Stock faible" },
  session_ouverte:     { icon: "🏧", label: "Caisse non fermée" },
  commande_en_attente: { icon: "📦", label: "Livraison en retard" },
  commande_a_payer:    { icon: "💳", label: "Paiement dû" },
};

export default function AlertesPage() {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [stats,    setStats]    = useState({ total: 0, danger: 0, warning: 0, info: 0 });
  const [loading,  setLoading]  = useState(true);
  const [filtre,   setFiltre]   = useState<"tous" | "danger" | "warning" | "info">("tous");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
        setStats(json.stats);
        setLastFetch(new Date());
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const filtered = filtre === "tous"
    ? notifications
    : notifications.filter(n => n.severity === filtre);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "tous",    label: "Total",         value: stats.total,   color: "text-white",   bg: "bg-white/5",    border: "border-border" },
          { key: "danger",  label: "Critiques",     value: stats.danger,  color: "text-danger",  bg: "bg-danger/5",   border: "border-danger/20" },
          { key: "warning", label: "Avertissements",value: stats.warning, color: "text-warning", bg: "bg-warning/5",  border: "border-warning/20" },
          { key: "info",    label: "Informations",  value: stats.info,    color: "text-accent",  bg: "bg-accent/5",   border: "border-accent/20" },
        ].map(k => (
          <button
            key={k.key}
            onClick={() => setFiltre(k.key as any)}
            className={clsx(
              "rounded-2xl border p-4 text-left transition-all duration-200",
              k.bg, k.border,
              filtre === k.key ? "ring-2 ring-offset-1 ring-offset-bg ring-current" : "hover:opacity-80"
            )}
            style={{ color: filtre === k.key ? undefined : undefined }}
          >
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">{k.label}</p>
            <p className={clsx("text-3xl font-extrabold font-mono", k.color)}>{k.value}</p>
          </button>
        ))}
      </div>

      {/* Header liste */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              {filtre === "tous" ? "Toutes les alertes" : `Alertes ${SEV_CONFIG[filtre as keyof typeof SEV_CONFIG]?.label?.toLowerCase()}`}
            </h2>
            {lastFetch && (
              <p className="text-[11px] font-mono text-muted mt-0.5">
                Mis à jour à {lastFetch.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {" · "}actualisation auto toutes les 2 min
              </p>
            )}
          </div>
          <button
            onClick={fetchNotifs}
            disabled={loading}
            className="btn-ghost btn-sm flex items-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : "🔄"} Actualiser
          </button>
        </div>

        {/* Liste */}
        {loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 gap-3 text-muted font-mono text-sm">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Analyse en cours...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <span className="text-5xl">✅</span>
            <div className="text-center">
              <p className="font-bold text-lg">Tout est en ordre !</p>
              <p className="text-muted text-sm font-mono mt-1">
                {filtre === "tous"
                  ? "Aucune alerte active pour le moment."
                  : `Aucune alerte de type "${SEV_CONFIG[filtre as keyof typeof SEV_CONFIG]?.label?.toLowerCase()}".`}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(notif => {
              const sev  = SEV_CONFIG[notif.severity];
              const type = TYPE_CONFIG[notif.type] ?? { icon: "📌", label: notif.type };
              return (
                <Link
                  key={notif.id}
                  href={notif.href}
                  className={clsx(
                    "flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors",
                    "border-l-4",
                    notif.severity === "danger"  ? "border-l-danger"  :
                    notif.severity === "warning" ? "border-l-warning" : "border-l-accent"
                  )}
                >
                  {/* Icône type */}
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0",
                    sev.bg
                  )}>
                    {type.icon}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-sm">{notif.titre}</p>
                      <span className={sev.badge}>{sev.label}</span>
                    </div>
                    <p className="text-sm text-muted">{notif.message}</p>
                    <p className={clsx("text-[11px] font-mono font-bold mt-1 uppercase tracking-wide", sev.text)}>
                      {type.label}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={clsx("text-xs font-mono font-bold", sev.text)}>→ Voir</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Raccourcis actions rapides */}
      {stats.danger > 0 && (
        <div className={clsx(
          "rounded-2xl border p-5 flex items-center gap-4",
          "bg-danger/5 border-danger/20"
        )}>
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <p className="font-bold text-sm text-danger">
              {stats.danger} rupture{stats.danger > 1 ? "s" : ""} de stock détectée{stats.danger > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted mt-0.5 font-mono">
              Des produits sont épuisés. Pensez à passer des commandes fournisseurs.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/stock" className="btn-ghost btn-sm">Voir le stock</Link>
            <Link href="/commandes" className="btn-primary btn-sm">+ Commande</Link>
          </div>
        </div>
      )}
    </div>
  );
}
