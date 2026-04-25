// components/stock/AjustementModal.tsx
"use client";
import React from "react";
import { useState } from "react";
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";

interface Props {
  produit: { _id: string; nom: string; reference: string; seuilAlerte: number };
  boutique: { _id: string; nom: string };
  quantiteActuelle: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function AjustementModal({ produit, boutique, quantiteActuelle, onClose, onSaved }: Props) {
  const { submit } = useOfflineQueue();
  const [quantite, setQuantite] = useState(quantiteActuelle);
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const diff = quantite - quantiteActuelle;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await submit({
      endpoint: "/api/stock/ajustement",
      method:   "POST",
      body:     { produitId: produit._id, boutiqueId: boutique._id, quantite, motif },
      label:    `Ajustement ${produit.nom} — ${boutique.nom} → ${quantite}`,
      module:   "stock",
    });
    setLoading(false);
    if (!result.ok) { setError((result as any).error ?? "Une erreur est survenue."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold">Ajustement de stock</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">Correction manuelle après inventaire</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* Info produit */}
        <div className="bg-surface2 rounded-xl px-4 py-3 mb-5 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted font-mono text-xs">Produit</span>
            <span className="font-semibold">{produit.nom}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted font-mono text-xs">Emplacement</span>
            <span className="font-semibold text-accent">{boutique.nom}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted font-mono text-xs">Stock actuel</span>
            <span className={`font-mono font-bold ${quantiteActuelle <= produit.seuilAlerte && quantiteActuelle > 0 ? "text-danger" : "text-success"}`}>
              {quantiteActuelle} unité(s)
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Nouvelle quantité</label>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => setQuantite(Math.max(0, +((quantite - 1).toFixed(3))))}
                className="btn-ghost w-10 h-10 justify-center text-lg shrink-0">−</button>
              <input
                type="number" min={0} step="0.001"
                className="input text-center text-xl font-bold font-mono"
                value={quantite}
                onChange={e => setQuantite(Math.max(0, +e.target.value))}
              />
              <button type="button"
                onClick={() => setQuantite(+((quantite + 1).toFixed(3)))}
                className="btn-ghost w-10 h-10 justify-center text-lg shrink-0">+</button>
            </div>
          </div>

          {/* Différence visuelle */}
          {diff !== 0 && (
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-mono
              ${diff > 0 ? "bg-success/10 text-success border border-success/20"
                         : "bg-danger/10 text-danger border border-danger/20"}`}>
              <span>Variation</span>
              <span className="font-bold">{diff > 0 ? `+${diff}` : diff} unité(s)</span>
            </div>
          )}

          <div>
            <label className="input-label">Motif de l&apos;ajustement</label>
            <input className="input" placeholder="ex: inventaire physique, casse, vol..."
              value={motif} onChange={e => setMotif(e.target.value)} />
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-2.5 rounded-lg">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
              Annuler
            </button>
            <button type="submit" disabled={loading || diff === 0}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Enregistrement..." : "Valider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
