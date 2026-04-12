// components/employes/PaiementSalaireModal.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import clsx from "clsx";

interface Props {
  employe: any;
  mois: number;
  annee: number;
  boutiques: any[];
  onClose: () => void;
  onSaved: () => void;
}

const MOIS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const fmt  = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function PaiementSalaireModal({ employe, mois, annee, boutiques, onClose, onSaved }: Props) {
  const [avances, setAvances]         = useState<any[]>([]);
  const [boutiqueId, setBoutiqueId]   = useState(employe.boutique?._id || employe.boutique || "");
  const [modePaiement, setModePaiement] = useState("especes");
  const [note, setNote]               = useState("");
  const [loading, setLoading]         = useState(false);
  const [loadingAvances, setLoadingAvances] = useState(true);
  const [error, setError]             = useState("");

  useEffect(() => {
    fetch(`/api/employes/${employe._id}/avances`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          // Filtrer les avances en attente pour ce mois de déduction
          const avancesCeMois = j.data.filter((a: any) =>
            a.statut === "en_attente" &&
            a.moisDeduction === mois &&
            a.anneeDeduction === annee
          );
          setAvances(avancesCeMois);
        }
        setLoadingAvances(false);
      });
  }, [employe._id, mois, annee]);

  const totalAvances = avances.reduce((s, a) => s + a.montant, 0);
  const montantNet   = Math.max(0, employe.salaireBase - totalAvances);

  async function handlePayer(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res  = await fetch("/api/salaires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeId: employe._id,
        mois, annee,
        boutiqueSourceId: boutiqueId,
        modePaiement, note,
      }),
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
            <h2 className="text-base font-bold">Paiement du salaire</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {employe.prenom} {employe.nom} · {MOIS[mois]} {annee}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handlePayer} className="space-y-4">

          {/* Résumé calcul */}
          {loadingAvances ? (
            <div className="animate-pulse bg-surface2 rounded-xl h-24" />
          ) : (
            <div className="bg-surface2 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Salaire de base</span>
                  <span className="font-mono font-semibold">{fmt(employe.salaireBase)} F</span>
                </div>

                {avances.length > 0 ? (
                  <>
                    <div className="border-t border-border/50 pt-2">
                      <p className="text-[10px] font-mono text-warning uppercase tracking-widest mb-2">
                        Avances à déduire ({avances.length})
                      </p>
                      {avances.map(a => (
                        <div key={a._id} className="flex justify-between text-sm">
                          <span className="text-muted text-xs">
                            {a.motif || "Avance"} · {new Date(a.date).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="font-mono text-warning text-sm">−{fmt(a.montant)} F</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                      <span className="text-muted">Total avances</span>
                      <span className="font-mono font-bold text-warning">−{fmt(totalAvances)} F</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs font-mono text-muted text-center py-1">
                    Aucune avance à déduire ce mois
                  </div>
                )}
              </div>

              <div className={clsx(
                "flex items-center justify-between px-4 py-4 border-t border-border",
                "bg-gradient-to-r from-success/10 to-transparent"
              )}>
                <span className="font-bold">Net à payer</span>
                <span className="font-mono font-extrabold text-2xl text-success">{fmt(montantNet)} F</span>
              </div>
            </div>
          )}

          {/* Boutique source */}
          <div>
            <label className="input-label">Payer depuis la caisse de *</label>
            <select className="select" value={boutiqueId}
              onChange={e => setBoutiqueId(e.target.value)} required>
              <option value="">Choisir la caisse...</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
          </div>

          {/* Mode paiement */}
          <div>
            <label className="input-label">Mode de paiement</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "especes",      icon: "💵", label: "Espèces" },
                { v: "mobile_money", icon: "📱", label: "Mobile Money" },
                { v: "virement",     icon: "🏦", label: "Virement" },
              ].map(m => (
                <button key={m.v} type="button" onClick={() => setModePaiement(m.v)}
                  className={clsx("flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-xs font-medium transition-all",
                    modePaiement === m.v
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface2 text-muted2 hover:border-border2"
                  )}>
                  <span className="text-xl">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="input-label">Note</label>
            <input className="input" placeholder="Observation optionnelle..."
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit"
              disabled={loading || !boutiqueId || loadingAvances}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Paiement..." : `💸 Payer ${fmt(montantNet)} F`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
