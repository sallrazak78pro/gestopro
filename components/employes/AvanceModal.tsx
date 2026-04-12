// components/employes/AvanceModal.tsx
"use client";
import React from "react";
import { useState } from "react";

interface Props {
  employe: any;
  boutiques: any[];
  onClose: () => void;
  onSaved: () => void;
}

const MOIS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function AvanceModal({ employe, boutiques, onClose, onSaved }: Props) {
  const now = new Date();
  const [form, setForm] = useState({
    montant:        "",
    motif:          "",
    moisDeduction:  now.getMonth() + 1,
    anneeDeduction: now.getFullYear(),
    boutiqueId:     employe.boutique?._id || employe.boutique || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const ANNEES = [now.getFullYear(), now.getFullYear() + 1];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res  = await fetch(`/api/employes/${employe._id}/avances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.success) { setError(json.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card p-6 animate-slide-up">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold">Avance sur salaire</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {employe.prenom} {employe.nom} · Salaire base : {new Intl.NumberFormat("fr-FR").format(employe.salaireBase)} F
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="input-label">Montant de l'avance (F) *</label>
            <input type="number" min={1} step="1" className="input text-lg font-bold font-mono"
              placeholder="0" value={form.montant}
              onChange={e => set("montant", e.target.value)} required />
            {form.montant && +form.montant > employe.salaireBase && (
              <p className="text-xs font-mono text-warning mt-1">
                ⚠ L'avance dépasse le salaire de base
              </p>
            )}
          </div>

          <div>
            <label className="input-label">Motif</label>
            <input className="input" placeholder="Raison de l'avance..."
              value={form.motif} onChange={e => set("motif", e.target.value)} />
          </div>

          <div>
            <label className="input-label">Déduire sur le salaire de *</label>
            <div className="grid grid-cols-2 gap-3">
              <select className="select" value={form.moisDeduction}
                onChange={e => set("moisDeduction", +e.target.value)}>
                {MOIS.slice(1).map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
              <select className="select" value={form.anneeDeduction}
                onChange={e => set("anneeDeduction", +e.target.value)}>
                {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <p className="text-[10px] font-mono text-muted mt-1">
              Sera automatiquement déduite lors du paiement du salaire de {MOIS[form.moisDeduction]} {form.anneeDeduction}
            </p>
          </div>

          <div>
            <label className="input-label">Payer depuis la caisse de</label>
            <select className="select" value={form.boutiqueId}
              onChange={e => set("boutiqueId", e.target.value)}>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
          </div>

          {/* Récap */}
          {form.montant && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 space-y-1.5 text-sm">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Récapitulatif</p>
              <div className="flex justify-between">
                <span className="text-muted">Avance accordée</span>
                <span className="font-mono font-bold text-warning">
                  {new Intl.NumberFormat("fr-FR").format(+form.montant)} F
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Sera déduite de</span>
                <span className="font-mono">{MOIS[form.moisDeduction]} {form.anneeDeduction}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1.5">
                <span className="text-muted">Salaire net estimé</span>
                <span className="font-mono font-bold text-success">
                  {new Intl.NumberFormat("fr-FR").format(Math.max(0, employe.salaireBase - +form.montant))} F
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading || !form.montant}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Enregistrement..." : "✓ Accorder l'avance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
