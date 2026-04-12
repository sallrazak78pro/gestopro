// components/caisse/FermetureCaisseModal.tsx
"use client";
import { useState } from "react";
import clsx from "clsx";
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";

interface Props {
  session: any;
  live: {
    totalVentes: number; ventesEspeces: number; ventesMobileMoney: number;
    ventesVirement: number; ventesCheque: number;
    totalEntrees: number; totalSorties: number; montantAttendu: number;
  };
  onClose: () => void;
  onSaved: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function FermetureCaisseModal({ session, live, onClose, onSaved }: Props) {
  const [montants, setMontants] = useState({
    especes:     "",
    mobileMoney: "",
    virement:    "",
    cheque:      "",
  });
  const [note, setNote]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [etape, setEtape]     = useState<"recap" | "transport" | "comptage" | "confirmation">("recap");
  const [fraisTransport, setFraisTransport] = useState("");

  const totalReel =
    (parseFloat(montants.especes)     || 0) +
    (parseFloat(montants.mobileMoney) || 0) +
    (parseFloat(montants.virement)    || 0) +
    (parseFloat(montants.cheque)      || 0);

  const ecart = totalReel - live.montantAttendu;

  const { submit } = useOfflineQueue();

  async function handleFermer() {
    setError(""); setLoading(true);
    const result = await submit({
      endpoint: `/api/sessions-caisse/${session._id}/fermer`,
      method:   "POST",
      body: {
        montantReelEspeces:     parseFloat(montants.especes)     || 0,
        montantReelMobileMoney: parseFloat(montants.mobileMoney) || 0,
        montantReelVirement:    parseFloat(montants.virement)    || 0,
        montantReelCheque:      parseFloat(montants.cheque)      || 0,
        noteFermeture: note,
        fraisTransport: parseFloat(fraisTransport) || 0,
      },
      label:  `Fermeture caisse — ${session.boutique?.nom ?? ""}`,
      module: "caisse",
    });
    setLoading(false);
    if (!result.ok) { setError((result as any).error ?? "Une erreur est survenue."); return; }
    onSaved();
  }

  const MODES = [
    { key: "especes",     label: "Espèces",      icon: "💵", attendu: (live.ventesEspeces ?? 0) + (session.fondOuverture ?? 0) },
    { key: "mobileMoney", label: "Mobile Money", icon: "📱", attendu: live.ventesMobileMoney },
    { key: "virement",    label: "Virement",     icon: "🏦", attendu: live.ventesVirement },
    { key: "cheque",      label: "Chèque",       icon: "📝", attendu: live.ventesCheque },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl card animate-slide-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold">Fermeture de caisse</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {session.boutique?.nom} · Ouverte par {session.ouvertPar?.nom}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* Étapes */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border shrink-0">
          {[
            { id: "recap",        label: "Récapitulatif" },
            { id: "transport",    label: "Transport" },
            { id: "comptage",     label: "Comptage" },
            { id: "confirmation", label: "Confirmation" },
          ].map((e, i) => (
            <div key={e.id} className="flex items-center gap-2">
              {i > 0 && <div className={clsx("w-8 h-px",
                (etape === "transport" && i <= 1) ||
                (etape === "comptage" && i <= 2) ||
                (etape === "confirmation" && i <= 3)
                  ? "bg-accent/50" : "bg-border")} />}
              <span className={clsx("flex items-center gap-1.5 text-xs font-mono",
                etape === e.id ? "text-accent" : "text-muted")}>
                <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  etape === e.id ? "bg-accent text-bg" : "bg-surface2 text-muted")}>
                  {i + 1}
                </span>
                {e.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ── ÉTAPE 1 : RÉCAPITULATIF ─────────────────── */}
          {etape === "recap" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">Voici le bilan de la session avant fermeture.</p>

              {/* Résumé chiffres */}
              <div className="space-y-2">
                {[
                  { label: "Fond d'ouverture",    value: session.fondOuverture,  sign: "",  color: "text-muted2" },
                  { label: "Total ventes",         value: live.totalVentes,        sign: "+", color: "text-success" },
                  { label: "Autres entrées",       value: live.totalEntrees,       sign: "+", color: "text-success" },
                  { label: "Sorties d'argent",     value: live.totalSorties,       sign: "−", color: "text-danger" },
                  ...(parseFloat(fraisTransport) > 0 ? [{ label: "Frais transport 🚗", value: parseFloat(fraisTransport), sign: "−", color: "text-warning" }] : []),
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/50">
                    <span className="text-sm text-muted2">{row.label}</span>
                    <span className={clsx("font-mono font-semibold", row.color)}>
                      {row.sign} {fmt(row.value)} F
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-accent/10 border border-accent/30
                                rounded-xl px-4 py-3 mt-2">
                  <span className="font-bold">Montant attendu en caisse</span>
                  <span className="font-mono font-extrabold text-xl text-accent">
                    {fmt(live.montantAttendu)} F
                  </span>
                </div>
              </div>

              {/* Détail par mode */}
              <div>
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">
                  Détail des ventes par mode de paiement
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {MODES.map(m => (
                    <div key={m.key} className="bg-surface2 rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className="text-xl">{m.icon}</span>
                      <div>
                        <p className="text-xs text-muted font-mono">{m.label}</p>
                        <p className="font-mono font-bold">{fmt(m.attendu)} F</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
                <button type="button" onClick={() => setEtape("transport")} className="btn-primary flex-1 justify-center">
                  Suivant : Transport →
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : FRAIS TRANSPORT ────────────────── */}
          {etape === "transport" && (
            <div className="p-6 space-y-5">
              <div className="bg-warning/5 border border-warning/20 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "var(--color-fg)" }}>Frais de transport des employés</p>
                    <p className="text-xs text-muted mt-0.5">
                      Ces frais seront déduits de la caisse et enregistrés comme dépense avant fermeture.
                    </p>
                  </div>
                </div>
                <label className="input-label">Montant total des frais de transport (F)</label>
                <input
                  type="number" min={0} step="1"
                  className="input text-lg font-bold font-mono"
                  placeholder="0"
                  value={fraisTransport}
                  onChange={e => setFraisTransport(e.target.value)}
                />
                {parseFloat(fraisTransport) > 0 && (
                  <div className="mt-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-2.5">
                    <p className="text-xs font-mono text-warning">
                      ⚠ {new Intl.NumberFormat("fr-FR").format(parseFloat(fraisTransport))} F seront déduits du montant attendu en caisse.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-surface2 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Montant attendu initial</span>
                  <span className="font-mono">{new Intl.NumberFormat("fr-FR").format(live.montantAttendu)} F</span>
                </div>
                <div className="flex justify-between text-warning">
                  <span>− Frais transport</span>
                  <span className="font-mono">− {new Intl.NumberFormat("fr-FR").format(parseFloat(fraisTransport) || 0)} F</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1.5" style={{ borderColor: "var(--color-border)" }}>
                  <span style={{ color: "var(--color-fg)" }}>Montant attendu corrigé</span>
                  <span className="font-mono text-accent">
                    {new Intl.NumberFormat("fr-FR").format(live.montantAttendu - (parseFloat(fraisTransport) || 0))} F
                  </span>
                </div>
              </div>

              <p className="text-[11px] font-mono text-muted text-center">
                Si pas de frais de transport, laisser à 0 et continuer.
              </p>

              <div className="flex gap-3">
                <button type="button" onClick={() => setEtape("recap")} className="btn-ghost flex-1 justify-center">← Retour</button>
                <button type="button" onClick={() => setEtape("comptage")} className="btn-primary flex-1 justify-center">
                  Passer au comptage →
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 : COMPTAGE RÉEL ──────────────────── */}
          {etape === "comptage" && (
            <div className="space-y-5">
              <p className="text-sm text-muted">
                Comptez l'argent réellement présent en caisse et saisissez les montants.
              </p>

              {MODES.map(m => {
                const valeur = parseFloat((montants as any)[m.key]) || 0;
                const diff   = valeur - m.attendu;
                return (
                  <div key={m.key} className="bg-surface2 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{m.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{m.label}</p>
                        <p className="text-xs font-mono text-muted">
                          Attendu : <span className="text-white">{fmt(m.attendu)} F</span>
                        </p>
                      </div>
                      {(montants as any)[m.key] !== "" && (
                        <span className={clsx("text-xs font-mono font-bold px-2 py-1 rounded-lg",
                          diff === 0 ? "bg-success/15 text-success"
                          : diff > 0 ? "bg-warning/15 text-warning"
                          : "bg-danger/15 text-danger"
                        )}>
                          {diff > 0 ? "+" : ""}{fmt(diff)} F
                        </span>
                      )}
                    </div>
                    <input
                      type="number" min={0} step="1"
                      className="input text-lg font-bold font-mono"
                      placeholder="Montant compté..."
                      value={(montants as any)[m.key]}
                      onChange={e => setMontants(prev => ({ ...prev, [m.key]: e.target.value }))}
                    />
                  </div>
                );
              })}

              {/* Note */}
              <div>
                <label className="input-label">Note de fermeture</label>
                <input type="text" className="input" placeholder="Observation..."
                  value={note} onChange={e => setNote(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setEtape("transport")} className="btn-ghost flex-1 justify-center">← Retour</button>
                <button type="button" onClick={() => setEtape("confirmation")} className="btn-primary flex-1 justify-center">
                  Voir le bilan →
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 : CONFIRMATION ───────────────────── */}
          {etape === "confirmation" && (
            <div className="space-y-5">
              <p className="text-sm text-muted">Vérifiez l'écart avant de fermer définitivement la caisse.</p>

              {/* Comparaison attendu vs réel */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-accent/10 border border-accent/30 rounded-2xl p-5 text-center">
                  <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Montant attendu</p>
                  <p className="text-2xl font-extrabold font-mono text-accent">{fmt(live.montantAttendu)} F</p>
                  <p className="text-xs text-muted font-mono mt-1">Calculé par le système</p>
                </div>
                <div className="bg-surface2 border border-border rounded-2xl p-5 text-center">
                  <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Montant compté</p>
                  <p className="text-2xl font-extrabold font-mono text-white">{fmt(totalReel)} F</p>
                  <p className="text-xs text-muted font-mono mt-1">Saisi manuellement</p>
                </div>
              </div>

              {/* Écart */}
              <div className={clsx(
                "rounded-2xl p-5 text-center border-2",
                ecart === 0 ? "bg-success/10 border-success/40"
                : ecart > 0 ? "bg-warning/10 border-warning/40"
                : "bg-danger/10 border-danger/40"
              )}>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-2 opacity-70">
                  {ecart === 0 ? "✓ Caisse équilibrée" : ecart > 0 ? "⚠ Excédent" : "⚠ Déficit"}
                </p>
                <p className={clsx("text-3xl font-extrabold font-mono",
                  ecart === 0 ? "text-success" : ecart > 0 ? "text-warning" : "text-danger"
                )}>
                  {ecart > 0 ? "+" : ""}{fmt(ecart)} F
                </p>
                {ecart !== 0 && (
                  <p className="text-xs mt-2 opacity-70">
                    {ecart > 0
                      ? "La caisse contient plus d'argent que prévu"
                      : "La caisse contient moins d'argent que prévu"}
                  </p>
                )}
              </div>

              {/* Détail par mode */}
              <div className="space-y-2">
                {MODES.map(m => {
                  const reel = parseFloat((montants as any)[m.key]) || 0;
                  const diff = reel - m.attendu;
                  return (
                    <div key={m.key} className="flex items-center justify-between py-2 border-b border-border/50">
                      <span className="text-sm flex items-center gap-2">
                        {m.icon} {m.label}
                      </span>
                      <div className="text-right">
                        <span className="font-mono text-sm">{fmt(reel)} F</span>
                        {diff !== 0 && (
                          <span className={clsx("text-xs font-mono ml-2",
                            diff > 0 ? "text-warning" : "text-danger"
                          )}>
                            ({diff > 0 ? "+" : ""}{fmt(diff)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                  ⚠ {error}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setEtape("comptage")} className="btn-ghost flex-1 justify-center">
                  ← Modifier
                </button>
                <button
                  type="button"
                  onClick={handleFermer}
                  disabled={loading}
                  className="btn-danger flex-1 justify-center disabled:opacity-60">
                  {loading ? "Fermeture..." : "🔒 Fermer la caisse"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
