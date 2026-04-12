// app/(dashboard)/versements/page.tsx
"use client";
import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtDate = (d: string) => new Date(d).toLocaleString("fr-FR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const STATUT_CONF: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: "En attente",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  confirme:   { label: "Confirmé",    color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  rejete:     { label: "Rejeté",      color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
};

export default function VersementsPage() {
  const { data: session } = useSession();
  const role     = (session?.user as any)?.role ?? "";
  const isAdmin  = ["admin", "superadmin"].includes(role);

  const [versements, setVersements] = useState<any[]>([]);
  const [boutiques,  setBoutiques]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");

  // Modal nouveau versement
  const [showModal, setShowModal]   = useState(false);
  const [montant,   setMontant]     = useState("");
  const [date,      setDate]        = useState(new Date().toISOString().split("T")[0]);
  const [boutiqueId,setBoutiqueId]  = useState("");

  // Modal confirmation/rejet
  const [actionModal, setActionModal] = useState<{ versement: any; action: "confirmer" | "rejeter" } | null>(null);
  const [rejetMotif,  setRejetMotif]  = useState("");

  const flash = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  };

  const fetchVersements = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtreStatut) params.set("statut", filtreStatut);
    const res  = await fetch(`/api/versements?${params}`);
    const json = await res.json();
    if (json.success) setVersements(json.data);
    setLoading(false);
  }, [filtreStatut]);

  useEffect(() => { fetchVersements(); }, [fetchVersements]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/boutiques").then(r => r.json())
        .then(j => j.success && setBoutiques(j.data.filter((b: any) => b.type === "boutique")));
    }
  }, [isAdmin]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!montant || parseFloat(montant) <= 0) { flash("Montant invalide.", true); return; }
    setSaving(true);
    const res  = await fetch("/api/versements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montant: parseFloat(montant), boutiqueId, date }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setShowModal(false); setMontant(""); setDate(new Date().toISOString().split("T")[0]);
      flash("Versement soumis. En attente de confirmation admin.");
      fetchVersements();
    } else {
      flash(json.message, true);
    }
  }

  async function handleAction() {
    if (!actionModal) return;
    setSaving(true);
    const res = await fetch(`/api/versements/${actionModal.versement._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionModal.action, rejetMotif }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setActionModal(null); setRejetMotif("");
      flash(actionModal.action === "confirmer" ? "Versement confirmé !" : "Versement rejeté.");
      fetchVersements();
    } else {
      flash(json.message, true);
    }
  }

  const nbEnAttente = versements.filter(v => v.statut === "en_attente").length;
  const totalConfirme = versements.filter(v => v.statut === "confirme").reduce((s, v) => s + v.montant, 0);

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-fg)" }}>
            💸 Versements caisse centrale
          </h1>
          <p className="text-xs font-mono text-muted mt-1">
            Transferts des boutiques vers la caisse centrale
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start">
          + Nouveau versement
        </button>
      </div>

      {/* Flashs */}
      {error   && <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">⚠ {error}</div>}
      {success && <div className="text-xs text-success bg-success/10 border border-success/20 rounded-xl px-4 py-3">✓ {success}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-warning" />
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">En attente</p>
          <p className="text-2xl font-extrabold text-warning">{nbEnAttente}</p>
          <p className="text-xs text-muted">versement{nbEnAttente > 1 ? "s" : ""} à valider</p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-success" />
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Total confirmé</p>
          <p className="text-xl font-extrabold text-success">{fmt(totalConfirme)} <span className="text-sm font-mono text-muted">F</span></p>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Total versements</p>
          <p className="text-2xl font-extrabold" style={{ color: "var(--color-fg)" }}>{versements.length}</p>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="card p-4 flex flex-wrap items-center gap-2">
        {[
          { key: "",           label: "Tous" },
          { key: "en_attente", label: "🟡 En attente" },
          { key: "confirme",   label: "🟢 Confirmés" },
          { key: "rejete",     label: "🔴 Rejetés" },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltreStatut(f.key)}
            className={clsx(
              "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all",
              filtreStatut === f.key
                ? "bg-accent text-bg border-accent"
                : "text-muted2 border-border hover:border-border2 hover:text-fg"
            )}>
            {f.label}
          </button>
        ))}
        <button onClick={fetchVersements} className="btn-ghost btn-sm ml-auto">🔄</button>
      </div>

      {/* Tableau */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-muted font-mono text-sm">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Chargement…
          </div>
        ) : versements.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💸</p>
            <p className="text-muted font-mono text-sm">Aucun versement{filtreStatut ? " dans ce statut" : ""}</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4">+ Créer un versement</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Boutique</th>
                  <th className="text-right">Montant</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Créé par</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {versements.map(v => {
                  const sc = STATUT_CONF[v.statut] ?? STATUT_CONF.en_attente;
                  return (
                    <tr key={v._id}>
                      <td className="font-mono text-xs text-accent">{v.reference}</td>
                      <td className="font-semibold">{v.boutique?.nom ?? "—"}</td>
                      <td className="text-right font-mono font-bold">{fmt(v.montant)} F</td>
                      <td className="text-xs font-mono text-muted">{fmtDate(v.createdAt)}</td>
                      <td>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-bold"
                          style={{ color: sc.color, background: sc.bg }}>
                          {sc.label}
                        </span>
                        {v.statut === "confirme" && v.confirmedBy && (
                          <p className="text-[10px] text-muted mt-0.5">
                            par {v.confirmedBy.prenom} {v.confirmedBy.nom}
                          </p>
                        )}
                        {v.statut === "rejete" && v.rejetMotif && (
                          <p className="text-[10px] text-danger mt-0.5 italic">{v.rejetMotif}</p>
                        )}
                      </td>
                      <td className="text-xs text-muted">
                        {v.createdBy?.prenom} {v.createdBy?.nom}
                      </td>
                      {isAdmin && (
                        <td>
                          {v.statut === "en_attente" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setActionModal({ versement: v, action: "confirmer" })}
                                className="btn-success btn-sm text-xs px-2.5 py-1">
                                ✓ Confirmer
                              </button>
                              <button
                                onClick={() => { setActionModal({ versement: v, action: "rejeter" }); setRejetMotif(""); }}
                                className="btn-danger btn-sm text-xs px-2.5 py-1">
                                ✕ Rejeter
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL NOUVEAU VERSEMENT ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">💸 Nouveau versement</h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-fg text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body space-y-4">
                <div className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 text-xs font-mono text-muted leading-relaxed">
                  💡 Ce versement sera soumis à la validation de l'administrateur avant d'être comptabilisé.
                </div>

                {/* Boutique (admin seulement) */}
                {isAdmin && boutiques.length > 0 && (
                  <div>
                    <label className="label">Boutique source</label>
                    <select className="select" value={boutiqueId} onChange={e => setBoutiqueId(e.target.value)} required>
                      <option value="">Sélectionner une boutique</option>
                      {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Montant versé (F)</label>
                  <input type="number" className="input" placeholder="0"
                    value={montant} onChange={e => setMontant(e.target.value)}
                    min="1" step="1" required />
                </div>

                <div>
                  <label className="label">Date du versement</label>
                  <input type="date" className="input" value={date}
                    onChange={e => setDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                  {saving ? "Envoi…" : "Soumettre le versement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMER / REJETER ── */}
      {actionModal && (
        <div className="modal-backdrop" onClick={() => setActionModal(null)}>
          <div className="modal-box w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {actionModal.action === "confirmer" ? "✓ Confirmer le versement" : "✕ Rejeter le versement"}
              </h2>
              <button onClick={() => setActionModal(null)} className="text-muted hover:text-fg text-xl">✕</button>
            </div>
            <div className="modal-body space-y-4">
              {/* Récap versement */}
              <div className="bg-surface2 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Référence</span>
                  <span className="font-mono text-accent">{actionModal.versement.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Boutique</span>
                  <span className="font-semibold">{actionModal.versement.boutique?.nom}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Montant</span>
                  <span className="font-mono font-bold text-lg" style={{ color: "var(--color-fg)" }}>
                    {fmt(actionModal.versement.montant)} F
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Date</span>
                  <span className="font-mono text-xs">{fmtDate(actionModal.versement.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Soumis par</span>
                  <span>{actionModal.versement.createdBy?.prenom} {actionModal.versement.createdBy?.nom}</span>
                </div>
              </div>

              {actionModal.action === "confirmer" ? (
                <div className="text-xs text-success bg-success/10 border border-success/20 rounded-xl px-3 py-2.5">
                  ✓ Ce versement sera marqué comme reçu dans la caisse centrale.
                </div>
              ) : (
                <>
                  <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2.5">
                    ⚠ Ce versement sera annulé. La boutique devra en créer un nouveau.
                  </div>
                  <div>
                    <label className="label">Motif du rejet (optionnel)</label>
                    <input type="text" className="input" placeholder="Ex: montant incorrect, date erronée…"
                      value={rejetMotif} onChange={e => setRejetMotif(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setActionModal(null)} className="btn-ghost">Annuler</button>
              <button onClick={handleAction} disabled={saving}
                className={clsx(
                  "disabled:opacity-60",
                  actionModal.action === "confirmer" ? "btn-success" : "btn-danger"
                )}>
                {saving ? "…" : actionModal.action === "confirmer" ? "✓ Confirmer" : "✕ Rejeter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
