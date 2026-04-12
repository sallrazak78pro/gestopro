// components/tresorerie/NouveauTiersModal.tsx
"use client";
import React from "react";
import { useState } from "react";

interface Boutique { _id: string; nom: string; }

export default function NouveauTiersModal({
  boutiques, onClose, onSaved
}: { boutiques: Boutique[]; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState({ nom: "", telephone: "", boutique: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res  = await fetch("/api/tiers", {
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold">Nouveau compte tiers</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              Personne qui garde son argent en boutique
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Nom complet *</label>
            <input className="input" placeholder="ex: Jean Kouassi"
              value={form.nom} onChange={e => set("nom", e.target.value)} required />
          </div>
          <div>
            <label className="input-label">Téléphone</label>
            <input className="input" placeholder="ex: +225 07 00 00 00"
              value={form.telephone} onChange={e => set("telephone", e.target.value)} />
          </div>
          <div>
            <label className="input-label">Boutique de rattachement *</label>
            <select className="select" value={form.boutique}
              onChange={e => set("boutique", e.target.value)} required>
              <option value="">Choisir une boutique...</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
          </div>
          <div className="bg-surface2 rounded-xl px-4 py-3">
            <p className="text-xs text-muted font-mono">
              💡 Le solde démarre à <strong>0 F</strong>. La personne pourra déposer de l'argent depuis la page Comptes Tiers.
            </p>
          </div>
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-2.5 rounded-xl">
              ⚠ {error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center disabled:opacity-60">
              {loading ? "Création..." : "Créer le compte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
