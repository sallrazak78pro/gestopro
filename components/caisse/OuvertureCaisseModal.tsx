// components/caisse/OuvertureCaisseModal.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";

interface Props {
  boutiqueId:   string;
  boutiqueName: string;
  onClose:  () => void;
  onSaved:  () => void;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export default function OuvertureCaisseModal({ boutiqueId, boutiqueName, onClose, onSaved }: Props) {
  // Fond attendu = montant compté à la dernière fermeture (null : première ouverture).
  const [fondAttendu, setFondAttendu] = useState<number | null>(null);
  const [dateDerniereFermeture, setDateDerniereFermeture] = useState<string | null>(null);
  // Montant réellement compté dans la caisse — volontairement vide au départ :
  // pré-remplir avec le fond attendu reviendrait à ne jamais compter.
  const [montantCompte, setMontantCompte] = useState("");
  const [note, setNote]              = useState("");
  const [loading, setLoading]        = useState(false);
  const [loadingFond, setLoadingFond] = useState(true);
  const [error, setError]            = useState("");
  const { submit } = useOfflineQueue();

  useEffect(() => {
    setLoadingFond(true);
    fetch(`/api/sessions-caisse/dernier-solde?boutiqueId=${boutiqueId}`)
      .then(r => r.json())
      .then(j => {
        if (!j.success || j.data.premiereFois) { setFondAttendu(null); return; }
        setFondAttendu(j.data.fondSuggere ?? 0);
        if (j.data.dateFermeture) {
          setDateDerniereFermeture(
            new Date(j.data.dateFermeture).toLocaleString("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
              hour: "2-digit", minute: "2-digit",
            })
          );
        }
      })
      .catch(() => setFondAttendu(null))
      .finally(() => setLoadingFond(false));
  }, [boutiqueId]);

  const compte = montantCompte === "" ? null : parseFloat(montantCompte);
  const ecart  = compte !== null && fondAttendu !== null ? compte - fondAttendu : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (compte === null || !Number.isFinite(compte) || compte < 0) {
      setError("Comptez la caisse et saisissez le montant trouvé.");
      return;
    }
    setError(""); setLoading(true);
    const result = await submit({
      endpoint: "/api/sessions-caisse",
      method:   "POST",
      body:     { boutiqueId, montantCompte: compte, noteOuverture: note },
      label:    `Ouverture caisse ${boutiqueName} — compté ${fmt(compte)} F`,
      module:   "caisse",
    });
    setLoading(false);
    if (!result.ok) { setError((result as any).error ?? "Une erreur est survenue."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card p-6 animate-slide-up max-h-[92vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">Ouverture de caisse</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">{boutiqueName}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* Heure d'ouverture */}
        <div className="bg-success/10 border border-success/30 rounded-xl px-4 py-3 flex items-center gap-3 mb-5">
          <span className="text-2xl">🟢</span>
          <div>
            <p className="text-sm font-bold text-success">Ouverture de la caisse</p>
            <p className="text-xs font-mono text-muted">
              {new Date().toLocaleString("fr-FR", {
                weekday: "long", day: "numeric", month: "long",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Fond attendu (référence) */}
          {loadingFond ? (
            <div className="input flex items-center gap-2 text-muted font-mono text-sm">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Chargement du solde précédent...
            </div>
          ) : fondAttendu !== null ? (
            <div className="bg-surface2 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Fond attendu</span>
                <span className="font-mono font-bold">{fmt(fondAttendu)} F</span>
              </div>
              {dateDerniereFermeture && (
                <p className="text-[10px] font-mono text-muted mt-1">
                  Montant compté à la fermeture du {dateDerniereFermeture}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] font-mono text-muted">
              Première ouverture de cette caisse — le montant compté devient le fond de départ.
            </p>
          )}

          {/* Montant compté */}
          <div>
            <label className="input-label">Montant compté dans la caisse (F) *</label>
            <input
              type="number" min={0} step="1" required autoFocus
              className="input text-xl font-bold font-mono"
              placeholder="Comptez la caisse puis saisissez le montant"
              value={montantCompte}
              disabled={loadingFond}
              onChange={e => setMontantCompte(e.target.value)}
            />
          </div>

          {/* Écart par rapport à la dernière fermeture */}
          {fondAttendu !== null && compte !== null && Number.isFinite(compte) && (
            ecart === 0 ? (
              <div className="bg-success/10 border border-success/20 rounded-lg px-4 py-2.5 flex justify-between text-sm font-mono text-success">
                <span>✓ Conforme à la dernière fermeture</span>
                <span className="font-bold">0 F</span>
              </div>
            ) : (
              <div className={`rounded-lg px-4 py-2.5 border text-sm font-mono ${
                ecart > 0 ? "bg-warning/10 border-warning/30 text-warning" : "bg-danger/10 border-danger/30 text-danger"
              }`}>
                <div className="flex justify-between gap-3">
                  <span>{ecart > 0 ? "Excédent" : "Manquant"} depuis la dernière fermeture</span>
                  <span className="font-bold whitespace-nowrap shrink-0">{ecart > 0 ? "+" : "−"}{fmt(Math.abs(ecart))} F</span>
                </div>
                <p className="text-[10px] mt-1 opacity-80">
                  Enregistré comme ajustement ({ecart > 0 ? "excédent" : "manquant"}) dans la trésorerie.
                  Précisez la raison dans la note.
                </p>
              </div>
            )
          )}

          <div>
            <label className="input-label">
              Note d&apos;ouverture {ecart !== 0 ? "(raison de l'écart)" : "(optionnel)"}
            </label>
            <input
              type="text" className="input"
              placeholder={ecart !== 0 ? "Ex : retrait du gérant non enregistré..." : "Observation..."}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Récap */}
          <div className="bg-surface2 rounded-xl px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Boutique</span>
              <span className="font-semibold">{boutiqueName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Fond de départ</span>
              <span className="font-mono font-bold text-accent">{compte !== null && Number.isFinite(compte) ? `${fmt(compte)} F` : "—"}</span>
            </div>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
              Annuler
            </button>
            <button type="submit" disabled={loading || loadingFond || montantCompte === ""}
              className="btn-primary flex-1 justify-center disabled:opacity-60">
              {loading ? "Ouverture..." : "🟢 Ouvrir la caisse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
