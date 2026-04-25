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
  const [fondOuverture, setFond]     = useState<number>(0);
  const [fondBloque, setFondBloque]  = useState(false);
  const [premiereFois, setPremiereFois] = useState(false);
  const [dateDerniereFermeture, setDateDerniereFermeture] = useState<string | null>(null);
  const [note, setNote]              = useState("");
  const [loading, setLoading]        = useState(false);
  const [loadingFond, setLoadingFond] = useState(true);
  const [error, setError]            = useState("");
  const { submit } = useOfflineQueue();

  // Charger le fond suggéré depuis la dernière fermeture
  useEffect(() => {
    setLoadingFond(true);
    fetch(`/api/sessions-caisse/dernier-solde?boutiqueId=${boutiqueId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          if (j.data.premiereFois) {
            // Première ouverture → fond libre
            setPremiereFois(true);
            setFond(0);
            setFondBloque(false);
          } else {
            // Fond = montant réel de la dernière fermeture → bloqué
            setFond(j.data.fondSuggere ?? 0);
            setFondBloque(true);
            if (j.data.dateFermeture) {
              setDateDerniereFermeture(
                new Date(j.data.dateFermeture).toLocaleString("fr-FR", {
                  weekday: "long", day: "numeric", month: "long",
                  hour: "2-digit", minute: "2-digit",
                })
              );
            }
          }
        }
      })
      .catch(() => {
        setPremiereFois(true);
        setFond(0);
      })
      .finally(() => setLoadingFond(false));
  }, [boutiqueId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await submit({
      endpoint: "/api/sessions-caisse",
      method:   "POST",
      body:     { boutiqueId, fondOuverture: fondOuverture, noteOuverture: note },
      label:    `Ouverture caisse ${boutiqueName} — fond ${fmt(fondOuverture)} F`,
      module:   "caisse",
    });
    setLoading(false);
    if (!result.ok) { setError((result as any).error ?? "Une erreur est survenue."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card p-6 animate-slide-up">

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

          {/* Fond d'ouverture */}
          <div>
            <label className="input-label">Fond de caisse (F)</label>

            {loadingFond ? (
              <div className="input flex items-center gap-2 text-muted font-mono text-sm">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Chargement du solde précédent...
              </div>
            ) : fondBloque ? (
              // Fond bloqué = fermeture précédente
              <div className="relative">
                <input
                  type="number"
                  className="input text-xl font-bold font-mono bg-success/5 border-success/40 cursor-not-allowed"
                  value={fondOuverture}
                  readOnly
                  disabled
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success text-sm">🔒</span>
              </div>
            ) : (
              // Première ouverture → fond libre
              <input
                type="number" min={0} step="1"
                className="input text-lg font-bold font-mono"
                placeholder="0"
                value={fondOuverture || ""}
                onChange={e => setFond(parseFloat(e.target.value) || 0)}
              />
            )}

            {/* Message explicatif selon le cas */}
            {!loadingFond && fondBloque && dateDerniereFermeture && (
              <div className="mt-2 bg-success/5 border border-success/20 rounded-lg px-3 py-2">
                <p className="text-[11px] font-mono text-success font-semibold">
                  ✅ Fond automatique — fermeture du {dateDerniereFermeture}
                </p>
                <p className="text-[10px] font-mono text-muted mt-0.5">
                  Ce montant correspond à la caisse de la dernière fermeture.
                  Les frais de transport doivent être saisis comme dépense avant de fermer.
                </p>
              </div>
            )}
            {!loadingFond && premiereFois && (
              <p className="text-[10px] font-mono text-muted mt-1">
                Première ouverture — saisissez le fond de départ manuellement.
              </p>
            )}
          </div>

          <div>
            <label className="input-label">Note d&apos;ouverture (optionnel)</label>
            <input
              type="text" className="input"
              placeholder="Observation..."
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
              <span className="font-mono font-bold text-accent">{fmt(fondOuverture)} F</span>
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
            <button type="submit" disabled={loading || loadingFond}
              className="btn-primary flex-1 justify-center disabled:opacity-60">
              {loading ? "Ouverture..." : "🟢 Ouvrir la caisse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
