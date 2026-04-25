// components/fournisseurs/ReceptionModal.tsx
"use client";
import { useState } from "react";

interface Props {
  commande: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReceptionModal({ commande, onClose, onSaved }: Props) {
  const [qtesRecues, setQtesRecues] = useState<Record<number, number>>(
    Object.fromEntries(
      commande.lignes.map((l: any, i: number) => [
        i,
        Math.max(0, l.quantiteCommandee - l.quantiteRecue),
      ])
    )
  );
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  const handleSubmit = async () => {
    setErr("");
    const receptions = Object.entries(qtesRecues)
      .map(([idx, qte]) => ({ ligneIndex: Number(idx), quantiteRecue: Number(qte) }))
      .filter(r => r.quantiteRecue > 0);

    if (!receptions.length) {
      setErr("Saisissez au moins une quantité à réceptionner.");
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`/api/commandes/${commande._id}/recevoir`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ receptions, note }),
      });
      const json = await res.json();
      if (!json.success) { setErr(json.message); return; }
      onSaved();
    } catch {
      setErr("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-lg w-full">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">📦 Réceptionner la marchandise</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">{commande.reference}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm btn-icon">✕</button>
        </div>

        <div className="modal-body space-y-4">
          <p className="text-sm text-muted">
            Destination : <span className="font-semibold text-white">{commande.destination?.nom}</span>
          </p>

          <div className="space-y-3">
            {commande.lignes.map((l: any, i: number) => {
              const restant = l.quantiteCommandee - l.quantiteRecue;
              const deja    = l.quantiteRecue;
              return (
                <div key={i} className={restant <= 0 ? "opacity-40 pointer-events-none" : ""}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-semibold">{l.nomProduit}</p>
                      <p className="text-[11px] font-mono text-muted">
                        Commandé : {l.quantiteCommandee} · Déjà reçu : {deja} · Restant : {restant}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-muted font-mono shrink-0">Qté à recevoir</label>
                    <input
                      type="number" min={0} max={restant} step="0.001"
                      className="input flex-1"
                      value={qtesRecues[i] ?? 0}
                      onChange={e => setQtesRecues(prev => ({ ...prev, [i]: Number(e.target.value) }))}
                      disabled={restant <= 0}
                    />
                    <button type="button" className="btn-ghost btn-sm shrink-0"
                      onClick={() => setQtesRecues(prev => ({ ...prev, [i]: restant }))}>
                      Tout
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="label">Note (optionnel)</label>
            <input className="input w-full" placeholder="Ex: Livraison partielle, colis endommagé..."
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {err && <p className="text-danger text-sm font-mono">{err}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Réception en cours..." : "✅ Confirmer la réception"}
          </button>
        </div>
      </div>
    </div>
  );
}
