// components/fournisseurs/PaiementFournisseurModal.tsx
"use client";
import { useState, useEffect } from "react";

interface Props {
  commande:   any;
  boutiques:  any[];
  onClose:    () => void;
  onSaved:    () => void;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const MODES = [
  { value: "especes",  label: "Espèces",  icon: "💵" },
  { value: "virement", label: "Virement", icon: "🏦" },
  { value: "cheque",   label: "Chèque",   icon: "📄" },
  { value: "mobile",   label: "Mobile",   icon: "📱" },
];

export default function PaiementFournisseurModal({ commande, boutiques, onClose, onSaved }: Props) {
  const [montant,      setMontant]      = useState(commande.montantDu);
  const [boutiqueId,   setBoutiqueId]   = useState(boutiques[0]?._id ?? "");
  const [modePaiement, setModePaiement] = useState("especes");
  const [note,         setNote]         = useState("");
  const [solde,        setSolde]        = useState<number | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState("");

  // Fetch solde when boutique changes
  useEffect(() => {
    if (!boutiqueId) return;
    fetch(`/api/tresorerie/solde?boutique=${boutiqueId}`)
      .then(r => r.json())
      .then(j => j.success && setSolde(j.data.solde))
      .catch(() => {});
  }, [boutiqueId]);

  const handleSubmit = async () => {
    setErr("");
    if (!montant || montant <= 0) { setErr("Montant invalide."); return; }
    if (montant > commande.montantDu) {
      setErr(`Maximum payable : ${fmt(commande.montantDu)} F`);
      return;
    }
    if (modePaiement === "especes" && solde !== null && montant > solde) {
      setErr(`Solde de caisse insuffisant (${fmt(solde)} F disponibles).`);
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`/api/commandes/${commande._id}/payer`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ montant, boutiqueId, modePaiement, note }),
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
      <div className="modal-box max-w-md w-full">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">💳 Paiement fournisseur</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {commande.fournisseur?.nom} · {commande.reference}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm btn-icon">✕</button>
        </div>

        <div className="modal-body space-y-4">
          {/* Récap */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface2 rounded-xl px-4 py-3 text-center">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Déjà payé</p>
              <p className="font-mono font-bold text-success">{fmt(commande.montantPaye)} F</p>
            </div>
            <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 text-center">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Reste dû</p>
              <p className="font-mono font-bold text-danger">{fmt(commande.montantDu)} F</p>
            </div>
          </div>

          {/* Montant à payer */}
          <div>
            <label className="label">Montant à payer (F)</label>
            <div className="flex gap-2">
              <input type="number" min={1} max={commande.montantDu} className="input flex-1"
                value={montant}
                onChange={e => setMontant(Number(e.target.value))} />
              <button type="button" className="btn-ghost btn-sm shrink-0"
                onClick={() => setMontant(commande.montantDu)}>
                Tout régler
              </button>
            </div>
          </div>

          {/* Mode de paiement */}
          <div>
            <label className="label">Mode de paiement</label>
            <div className="flex gap-2 flex-wrap">
              {MODES.map(m => (
                <button key={m.value} type="button"
                  onClick={() => setModePaiement(m.value)}
                  className={`btn-sm px-4 py-2 rounded-xl border font-mono text-xs transition-all ${
                    modePaiement === m.value
                      ? "bg-accent text-black border-accent font-bold"
                      : "bg-surface2 text-muted border-border2 hover:border-accent/50"
                  }`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Boutique / caisse */}
          <div>
            <label className="label">Imputer sur la caisse</label>
            <select className="input w-full" value={boutiqueId}
              onChange={e => setBoutiqueId(e.target.value)}>
              {boutiques.map(b => (
                <option key={b._id} value={b._id}>{b.nom}</option>
              ))}
            </select>
            {solde !== null && (
              <p className={`text-xs font-mono mt-1 ${solde < montant ? "text-danger" : "text-muted"}`}>
                Solde disponible : {fmt(solde)} F
                {solde < montant && " · ⚠️ Solde insuffisant"}
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="label">Note (optionnel)</label>
            <input className="input w-full" placeholder="Ex: Acompte, solde facture..."
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {err && <p className="text-danger text-sm font-mono">{err}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-success" onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement..." : `💳 Payer ${fmt(montant)} F`}
          </button>
        </div>
      </div>
    </div>
  );
}
