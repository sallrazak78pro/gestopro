// components/boutiques/BoutiqueModal.tsx
"use client";
import React from "react";
import { useState } from "react";
import clsx from "clsx";

interface Props {
  boutique?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function BoutiqueModal({ boutique, onClose, onSaved }: Props) {
  const isEdit = !!boutique;
  const [form, setForm] = useState({
    nom:          boutique?.nom          || "",
    type:         boutique?.type         || "boutique",
    adresse:      boutique?.adresse      || "",
    telephone:    boutique?.telephone    || "",
    estPrincipale: boutique?.estPrincipale || false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch(
      isEdit ? `/api/boutiques/${boutique._id}` : "/api/boutiques",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
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
            <h2 className="text-lg font-bold">
              {isEdit ? "Modifier" : "Nouvelle boutique / dépôt"}
            </h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {isEdit ? boutique.nom : "Ajoutez un point de vente ou un dépôt"}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Type */}
          <div>
            <label className="input-label">Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: "boutique", icon: "🏪", label: "Point de vente", desc: "Vend directement aux clients" },
                { v: "depot",    icon: "📦", label: "Dépôt",          desc: "Stocke la marchandise" },
              ].map(t => (
                <button key={t.v} type="button" onClick={() => set("type", t.v)}
                  className={clsx(
                    "flex flex-col items-start gap-1.5 px-4 py-3 rounded-xl border-2 text-left transition-all",
                    form.type === t.v
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-border bg-surface2 text-muted2 hover:border-border2"
                  )}>
                  <span className="text-2xl">{t.icon}</span>
                  <span className="text-sm font-bold">{t.label}</span>
                  <span className="text-[10px] opacity-70">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nom */}
          <div>
            <label className="input-label">Nom *</label>
            <input className="input" placeholder={form.type === "depot" ? "ex: Dépôt Central" : "ex: PDV Plateau"}
              value={form.nom} onChange={e => set("nom", e.target.value)} required />
          </div>

          {/* Adresse + Téléphone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Adresse</label>
              <input className="input" placeholder="ex: Rue du Commerce"
                value={form.adresse} onChange={e => set("adresse", e.target.value)} />
            </div>
            <div>
              <label className="input-label">Téléphone</label>
              <input className="input" placeholder="ex: +225 07 00 00 00"
                value={form.telephone} onChange={e => set("telephone", e.target.value)} />
            </div>
          </div>

          {/* Boutique principale (seulement pour les boutiques, pas les dépôts) */}
          {form.type === "boutique" && (
            <div
              onClick={() => set("estPrincipale", !form.estPrincipale)}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
                form.estPrincipale
                  ? "border-warning/50 bg-warning/5"
                  : "border-border bg-surface2 hover:border-border2"
              )}>
              <span className="text-2xl">⭐</span>
              <div className="flex-1">
                <p className="text-sm font-bold">Boutique principale</p>
                <p className="text-[11px] text-muted">Centralise l&apos;argent des versements hebdomadaires</p>
              </div>
              <div className={clsx(
                "w-10 h-6 rounded-full transition-all relative",
                form.estPrincipale ? "bg-warning" : "bg-surface"
              )}>
                <div className={clsx(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                  form.estPrincipale ? "left-5" : "left-1"
                )} />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading || !form.nom}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Enregistrement..." : isEdit ? "✓ Modifier" : "✓ Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
