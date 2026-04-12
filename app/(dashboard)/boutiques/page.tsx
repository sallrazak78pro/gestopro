// app/(dashboard)/boutiques/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import BoutiqueModal from "@/components/boutiques/BoutiqueModal";
import clsx from "clsx";

const TYPE_COLOR = ["#00d4ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444"];

export default function BoutiquesPage() {
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBoutique, setEdit]   = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBoutiques = useCallback(async () => {
    setLoading(true);
    // On récupère TOUT : boutiques et dépôts, actifs et inactifs
    const res  = await fetch("/api/boutiques?includeInactif=1");
    const json = await res.json();
    if (json.success) setBoutiques(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBoutiques(); }, [fetchBoutiques]);

  async function toggleActif(b: any) {
    if (b.estPrincipale) return;
    setActionLoading(b._id);
    await fetch(`/api/boutiques/${b._id}`, {
      method: b.actif ? "DELETE" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: true }),
    });
    await fetchBoutiques();
    setActionLoading(null);
  }

  const pdvs   = boutiques.filter(b => b.type === "boutique");
  const depots = boutiques.filter(b => b.type === "depot");
  const principale = boutiques.find(b => b.estPrincipale);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard label="Points de vente" value={String(pdvs.filter(b => b.actif).length)} change="Boutiques actives" trend="up" icon="🏪" />
        <KpiCard label="Dépôts" value={String(depots.filter(b => b.actif).length)} change="Dépôts actifs" trend="up" icon="📦" />
        <KpiCard label="Boutique principale" value={principale?.nom ?? "—"} change="Centralise la trésorerie" trend="up" icon="⭐" />
        <KpiCard label="Total emplacements" value={String(boutiques.filter(b => b.actif).length)} change="Actifs" trend="up" icon="📍" />
      </div>

      {/* Points de vente */}
      <Section
        title="Points de vente"
        icon="🏪"
        subtitle="Boutiques qui vendent directement aux clients"
        items={pdvs}
        loading={loading}
        onAdd={() => { setEdit(null); setShowModal(true); }}
        onEdit={(b) => { setEdit(b); setShowModal(true); }}
        onToggle={toggleActif}
        actionLoading={actionLoading}
        colors={TYPE_COLOR}
      />

      {/* Dépôts */}
      <Section
        title="Dépôts"
        icon="📦"
        subtitle="Entrepôts de stockage de la marchandise"
        items={depots}
        loading={loading}
        onAdd={() => { setEdit({ type: "depot" }); setShowModal(true); }}
        onEdit={(b) => { setEdit(b); setShowModal(true); }}
        onToggle={toggleActif}
        actionLoading={actionLoading}
        colors={["#10b981", "#f59e0b", "#ef4444"]}
      />

      {showModal && (
        <BoutiqueModal
          boutique={editBoutique}
          onClose={() => { setShowModal(false); setEdit(null); }}
          onSaved={() => { setShowModal(false); setEdit(null); fetchBoutiques(); }}
        />
      )}
    </div>
  );
}

// ── Section component ──────────────────────────────────────────
function Section({ title, icon, subtitle, items, loading, onAdd, onEdit, onToggle, actionLoading, colors }: any) {
  return (
    <div className="card">
      <div className="card-header flex-wrap gap-3">
        <div>
          <h2 className="card-title flex items-center gap-2">
            <span>{icon}</span> {title}
          </h2>
          <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">{subtitle}</p>
        </div>
        <button className="btn-primary btn-sm" onClick={onAdd}>+ Ajouter</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted font-mono text-sm gap-3">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Chargement...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-3xl">{icon}</p>
          <p className="text-muted font-mono text-sm">Aucun élément</p>
          <button className="btn-primary btn-sm" onClick={onAdd}>Ajouter</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {items.map((b: any, i: number) => (
            <div key={b._id} className={clsx(
              "relative rounded-2xl border-2 p-5 transition-all",
              b.actif
                ? "border-border hover:border-border2 bg-surface2"
                : "border-border/40 bg-surface2/50 opacity-50"
            )}>
              {/* Top bar colorée */}
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                style={{ background: colors[i % colors.length] }} />

              {/* Badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {b.estPrincipale && (
                  <span className="badge-orange text-[10px]">⭐ Principale</span>
                )}
                {!b.actif && <span className="badge-red text-[10px]">Inactif</span>}
              </div>

              {/* Nom & infos */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: `${colors[i % colors.length]}20`, border: `1px solid ${colors[i % colors.length]}40` }}>
                  {b.type === "depot" ? "📦" : "🏪"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{b.nom}</p>
                  <p className="text-[10px] font-mono text-muted capitalize">{b.type}</p>
                </div>
              </div>

              {/* Détails */}
              <div className="space-y-1.5 mb-4">
                {b.adresse && (
                  <div className="flex items-center gap-2 text-xs text-muted2">
                    <span>📍</span> <span className="truncate">{b.adresse}</span>
                  </div>
                )}
                {b.telephone && (
                  <div className="flex items-center gap-2 text-xs text-muted2">
                    <span>📞</span> <span>{b.telephone}</span>
                  </div>
                )}
                {!b.adresse && !b.telephone && (
                  <p className="text-[11px] font-mono text-muted italic">Aucune info de contact</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <button onClick={() => onEdit(b)} className="btn-ghost btn-sm flex-1 justify-center">
                  ✏️ Modifier
                </button>
                {!b.estPrincipale && (
                  <button
                    onClick={() => onToggle(b)}
                    disabled={actionLoading === b._id}
                    className={clsx("btn-sm flex-1 justify-center disabled:opacity-50",
                      b.actif ? "btn-danger" : "btn-success"
                    )}>
                    {actionLoading === b._id ? "..." : b.actif ? "🔒 Désactiver" : "🔓 Activer"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
