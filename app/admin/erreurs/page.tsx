// app/admin/erreurs/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";

interface Erreur {
  _id: string;
  userNom: string;
  userEmail: string;
  userRole: string;
  page: string;
  type: "bug" | "donnees" | "affichage" | "autre";
  description: string;
  statut: "nouveau" | "en_cours" | "resolu";
  adminNote?: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  bug: "🐛 Bug",
  donnees: "📊 Données",
  affichage: "🖥️ Affichage",
  autre: "💬 Autre",
};

const STATUT_CONFIG: Record<string, { label: string; cls: string }> = {
  nouveau:  { label: "Nouveau",   cls: "badge-red" },
  en_cours: { label: "En cours",  cls: "badge-orange" },
  resolu:   { label: "Résolu",    cls: "badge-green" },
};

const fmt = (d: string) =>
  new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminErreursPage() {
  const [erreurs, setErreurs] = useState<Erreur[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [selected, setSelected] = useState<Erreur | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchErreurs = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filtreStatut) p.set("statut", filtreStatut);
    if (filtreType)   p.set("type",   filtreType);
    const res = await fetch(`/api/erreurs?${p}`);
    const json = await res.json();
    if (json.success) setErreurs(json.data);
    setLoading(false);
  }, [filtreStatut, filtreType]);

  useEffect(() => { fetchErreurs(); }, [fetchErreurs]);

  async function updateErreur(id: string, patch: { statut?: string; adminNote?: string }) {
    setSaving(true);
    await fetch(`/api/erreurs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    fetchErreurs();
    if (selected?._id === id) {
      setSelected(prev => prev ? { ...prev, ...patch } as Erreur : null);
    }
  }

  const counts = {
    total:    erreurs.length,
    nouveau:  erreurs.filter(e => e.statut === "nouveau").length,
    en_cours: erreurs.filter(e => e.statut === "en_cours").length,
    resolu:   erreurs.filter(e => e.statut === "resolu").length,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-fg)" }}>
            🐛 Erreurs signalées
          </h1>
          <p className="text-xs font-mono text-muted mt-1 uppercase tracking-widest">
            Retours utilisateurs · tous tenants
          </p>
        </div>
        <button onClick={fetchErreurs} className="btn-ghost btn-sm">🔄 Actualiser</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.total, color: "#00d4ff" },
          { label: "Nouveaux", value: counts.nouveau, color: "#ef4444" },
          { label: "En cours", value: counts.en_cours, color: "#f59e0b" },
          { label: "Résolus", value: counts.resolu, color: "#10b981" },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <p className="text-[11px] font-mono text-muted uppercase tracking-widest">{k.label}</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="select w-44" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="nouveau">Nouveau</option>
          <option value="en_cours">En cours</option>
          <option value="resolu">Résolu</option>
        </select>
        <select className="select w-44" value={filtreType} onChange={e => setFiltreType(e.target.value)}>
          <option value="">Tous types</option>
          <option value="bug">Bug</option>
          <option value="donnees">Données</option>
          <option value="affichage">Affichage</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      {/* Table + Detail panel */}
      <div className="flex gap-5 items-start">

        {/* Table */}
        <div className="card flex-1 min-w-0">
          <div className="table-wrapper">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted font-mono text-sm gap-3">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Chargement...
              </div>
            ) : erreurs.length === 0 ? (
              <div className="text-center py-16 text-muted font-mono text-sm">Aucune erreur signalée</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Utilisateur</th>
                    <th>Type</th>
                    <th>Page</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {erreurs.map(e => (
                    <tr key={e._id}
                      className={clsx(
                        "cursor-pointer transition-colors",
                        selected?._id === e._id ? "bg-accent/5" : "hover:bg-surface2/50"
                      )}
                      onClick={() => { setSelected(e); setNoteInput(e.adminNote || ""); }}
                    >
                      <td className="font-mono text-xs text-muted whitespace-nowrap">{fmt(e.createdAt)}</td>
                      <td>
                        <p className="font-semibold text-sm">{e.userNom}</p>
                        <p className="text-[11px] font-mono text-muted">{e.userEmail}</p>
                      </td>
                      <td>
                        <span className="text-xs font-mono">{TYPE_LABELS[e.type]}</span>
                      </td>
                      <td className="font-mono text-xs text-accent max-w-[120px] truncate">{e.page}</td>
                      <td>
                        <span className={clsx("badge text-[10px]", STATUT_CONFIG[e.statut].cls)}>
                          {STATUT_CONFIG[e.statut].label}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {e.statut !== "en_cours" && (
                            <button
                              onClick={ev => { ev.stopPropagation(); updateErreur(e._id, { statut: "en_cours" }); }}
                              className="btn-ghost btn-sm text-[10px]"
                              title="Marquer en cours"
                            >🔄</button>
                          )}
                          {e.statut !== "resolu" && (
                            <button
                              onClick={ev => { ev.stopPropagation(); updateErreur(e._id, { statut: "resolu" }); }}
                              className="btn-ghost btn-sm text-[10px]"
                              title="Marquer résolu"
                            >✅</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!loading && (
            <div className="px-5 py-3 border-t border-border text-xs font-mono text-muted">
              {erreurs.length} erreur{erreurs.length !== 1 ? "s" : ""} affichée{erreurs.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 shrink-0 space-y-4">
            <div className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-sm" style={{ color: "var(--color-fg)" }}>Détail</h3>
                <button onClick={() => setSelected(null)} className="text-muted hover:text-fg text-lg leading-none">×</button>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <p><span className="text-muted">Utilisateur :</span> <span className="font-bold">{selected.userNom}</span></p>
                <p><span className="text-muted">Rôle :</span> {selected.userRole}</p>
                <p><span className="text-muted">Email :</span> {selected.userEmail}</p>
                <p><span className="text-muted">Page :</span> <span className="text-accent">{selected.page}</span></p>
                <p><span className="text-muted">Type :</span> {TYPE_LABELS[selected.type]}</p>
                <p><span className="text-muted">Date :</span> {fmt(selected.createdAt)}</p>
              </div>

              <div>
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5">Description</p>
                <p className="text-sm leading-relaxed bg-surface2 rounded-xl px-3 py-2.5">
                  {selected.description}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5">Note admin</p>
                <textarea
                  className="input min-h-[80px] text-sm resize-none"
                  placeholder="Ajouter une note..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                />
              </div>

              <div>
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2">Statut</p>
                <div className="flex gap-2">
                  {(["nouveau", "en_cours", "resolu"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => updateErreur(selected._id, { statut: s })}
                      className={clsx(
                        "flex-1 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all border",
                        selected.statut === s
                          ? "bg-accent text-white border-accent"
                          : "bg-surface2 text-muted border-border hover:border-border2"
                      )}
                    >
                      {STATUT_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => updateErreur(selected._id, { adminNote: noteInput })}
                disabled={saving}
                className="btn-primary w-full justify-center text-sm disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "💾 Sauvegarder la note"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
