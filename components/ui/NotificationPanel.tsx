// components/ui/NotificationPanel.tsx
"use client";
import React from "react";
import { useEffect, useRef } from "react";
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

interface Props {
  notifications: Notif[];
  onClose:       () => void;
  onRefresh?:    () => void;
  loading?:      boolean;
  anchorRef?:    React.RefObject<HTMLDivElement>;
}

const SEV_CONFIG = {
  danger:  { icon: "🔴", bg: "bg-danger/10",  border: "border-danger/30",  text: "text-danger",  dot: "bg-danger"  },
  warning: { icon: "🟡", bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", dot: "bg-warning" },
  info:    { icon: "🔵", bg: "bg-accent/10",  border: "border-accent/30",  text: "text-accent",  dot: "bg-accent"  },
};

const TYPE_LABEL: Record<string, string> = {
  rupture:             "Rupture de stock",
  stock_faible:        "Stock faible",
  session_ouverte:     "Caisse",
  commande_en_attente: "Livraison",
  commande_a_payer:    "Paiement dû",
};

export default function NotificationPanel({ notifications, onClose, onRefresh }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const ruptures   = notifications.filter(n => n.type === "rupture");
  const faibles    = notifications.filter(n => n.type === "stock_faible");
  const autres     = notifications.filter(n => !["rupture","stock_faible"].includes(n.type));

  const grouped = [
    { label: "Ruptures de stock",  items: ruptures, sev: "danger"  as const },
    { label: "Stocks faibles",     items: faibles,  sev: "warning" as const },
    { label: "Autres alertes",     items: autres,   sev: "info"    as const },
  ].filter(g => g.items.length > 0);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] flex flex-col
                 bg-surface border border-border2 rounded-2xl shadow-card z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <h3 className="text-sm font-bold">Notifications</h3>
          {notifications.length > 0 && (
            <span className="bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
              {notifications.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="text-muted hover:text-white transition-colors text-sm p-1 rounded-lg hover:bg-white/5"
            title="Actualiser"
          >
            🔄
          </button>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors text-sm p-1 rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-4xl">✅</span>
            <p className="text-sm font-semibold">Tout est en ordre !</p>
            <p className="text-xs text-muted font-mono text-center px-6">
              Aucune alerte active pour le moment
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(group => (
              <div key={group.label}>
                <div className="px-4 py-2 bg-surface2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted">
                    {group.label} · {group.items.length}
                  </p>
                </div>
                {group.items.map(notif => {
                  const cfg = SEV_CONFIG[notif.severity];
                  return (
                    <Link
                      key={notif.id}
                      href={notif.href}
                      onClick={onClose}
                      className={clsx(
                        "flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors",
                        "border-l-2",
                        notif.severity === "danger"  ? "border-danger"  :
                        notif.severity === "warning" ? "border-warning" : "border-accent"
                      )}
                    >
                      <span className={clsx(
                        "w-2 h-2 rounded-full shrink-0 mt-1.5",
                        cfg.dot
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight">{notif.titre}</p>
                        <p className="text-xs text-muted mt-0.5 leading-relaxed">{notif.message}</p>
                        <p className={clsx("text-[10px] font-mono font-bold mt-1 uppercase tracking-wide", cfg.text)}>
                          {TYPE_LABEL[notif.type] ?? notif.type}
                        </p>
                      </div>
                      <span className="text-muted text-xs shrink-0 mt-0.5">→</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-surface2 flex items-center justify-between">
          <p className="text-[11px] font-mono text-muted">
            {notifications.filter(n => n.severity === "danger").length > 0 && (
              <span className="text-danger font-bold">
                {notifications.filter(n => n.severity === "danger").length} critique{notifications.filter(n => n.severity === "danger").length > 1 ? "s" : ""}
              </span>
            )}
            {notifications.filter(n => n.severity === "danger").length > 0 &&
             notifications.filter(n => n.severity === "warning").length > 0 && " · "}
            {notifications.filter(n => n.severity === "warning").length > 0 && (
              <span className="text-warning">
                {notifications.filter(n => n.severity === "warning").length} avertissement{notifications.filter(n => n.severity === "warning").length > 1 ? "s" : ""}
              </span>
            )}
          </p>
          <Link href="/stock" onClick={onClose} className="text-[11px] font-mono text-accent hover:underline">
            Voir le stock →
          </Link>
        </div>
      )}
    </div>
  );
}
