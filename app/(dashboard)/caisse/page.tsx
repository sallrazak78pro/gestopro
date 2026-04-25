// app/(dashboard)/caisse/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import OuvertureCaisseModal from "@/components/caisse/OuvertureCaisseModal";
import FermetureCaisseModal from "@/components/caisse/FermetureCaisseModal";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function CaissePage() {
  const { data: authSession } = useSession();
  const boutiqueAssignee = (authSession?.user as any)?.boutique;

  const [boutiques, setBoutiques]         = useState<any[]>([]);
  const [boutiqueId, setBoutiqueId]       = useState("");
  const [sessionData, setSessionData]     = useState<any>(null);
  const [historique, setHistorique]       = useState<any[]>([]);

  // Dès que la session charge et qu'il y a une boutique assignée, l'appliquer
  useEffect(() => {
    if (boutiqueAssignee && !boutiqueId) {
      setBoutiqueId(boutiqueAssignee);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutiqueAssignee]);
  const [loading, setLoading]             = useState(false);
  const [showOuverture, setShowOuverture] = useState(false);
  const [showFermeture, setShowFermeture] = useState(false);

  // Charger les boutiques
  useEffect(() => {
    fetch("/api/boutiques?type=boutique")
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setBoutiques(j.data);
          if (!boutiqueId && j.data.length === 1) setBoutiqueId(j.data[0]._id);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger la session active + historique
  const fetchSession = useCallback(async () => {
    if (!boutiqueId) return;
    setLoading(true);
    const [activeRes, histRes] = await Promise.all([
      fetch(`/api/sessions-caisse/active?boutiqueId=${boutiqueId}`),
      fetch(`/api/sessions-caisse?boutique=${boutiqueId}&limit=10`),
    ]);
    const [active, hist] = await Promise.all([activeRes.json(), histRes.json()]);
    if (active.success) setSessionData(active.data);
    if (hist.success)   setHistorique(hist.data);
    setLoading(false);
  }, [boutiqueId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const session = sessionData?.session;
  const live    = sessionData?.live;

  // Durée de la session
  function dureeSession(depuis: string) {
    const diff = Date.now() - new Date(depuis).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}min` : `${m} min`;
  }

  return (
    <div className="space-y-6">

      {/* Sélecteur de boutique (si accès global) */}
      {!boutiqueAssignee && boutiques.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="input-label mb-0 shrink-0">Boutique</label>
          <select className="select w-64" value={boutiqueId} onChange={e => setBoutiqueId(e.target.value)}>
            <option value="">Choisir une boutique...</option>
            {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
          </select>
        </div>
      )}

      {!boutiqueId ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-muted font-mono text-sm">Sélectionne une boutique pour voir sa caisse</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64 text-muted font-mono text-sm gap-3">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Chargement...
        </div>
      ) : (
        <>
          {/* ── SESSION ACTIVE ─────────────────────────────── */}
          {session ? (
            <>
              {/* Bandeau session ouverte */}
              <div className="card border-success/40 bg-success/5 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-success/20 border border-success/40
                                    flex items-center justify-center text-2xl shrink-0">
                      🟢
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h2 className="text-lg font-bold">Caisse ouverte</h2>
                        <span className="badge-green text-xs">En cours</span>
                      </div>
                      <p className="text-sm text-muted2">
                        {session.boutique?.nom} · Ouverte par{" "}
                        <span className="font-semibold text-white">{session.ouvertPar?.nom}</span>
                        {" "}· Il y a <span className="font-mono text-accent">{dureeSession(session.dateOuverture)}</span>
                      </p>
                      <p className="text-xs font-mono text-muted mt-0.5">
                        Ouverture : {new Date(session.dateOuverture).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFermeture(true)}
                    className="btn-danger shrink-0">
                    🔒 Fermer la caisse
                  </button>
                </div>
              </div>

              {/* KPIs en temps réel */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Fond d'ouverture" value={fmt(session.fondOuverture) + " F"} change="Montant de départ" trend="neutral" icon="💼" />
                <KpiCard label="Ventes de la session" value={fmt(live?.totalVentes ?? 0) + " F"} change={`${live?.nbVentes ?? 0} transaction${(live?.nbVentes ?? 0) > 1 ? "s" : ""}`} trend="up" icon="🧾" />
                <KpiCard label="Entrées d'argent" value={fmt(live?.totalEntrees ?? 0) + " F"} change="Versements, avances..." trend="up" icon="📥" />
                <KpiCard label="Sorties d'argent" value={fmt(live?.totalSorties ?? 0) + " F"} change="Dépenses, versements..." trend="down" icon="📤" />
              </div>

              {/* Montant attendu en caisse */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="card-title">Montant attendu en caisse</h3>
                    <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
                      Fond + Ventes + Entrées − Sorties
                    </p>
                  </div>
                  <button onClick={fetchSession} className="btn-ghost btn-sm">🔄</button>
                </div>

                {/* Calcul détaillé */}
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Fond d'ouverture",       value: session.fondOuverture,      sign: "", color: "text-muted2" },
                    { label: "Ventes encaissées",       value: live?.totalVentes ?? 0,     sign: "+", color: "text-success" },
                    { label: "Autres entrées",          value: live?.totalEntrees ?? 0,    sign: "+", color: "text-success" },
                    { label: "Sorties",                 value: live?.totalSorties ?? 0,    sign: "−", color: "text-danger" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-muted2">{row.label}</span>
                      <span className={clsx("font-mono font-semibold text-sm", row.color)}>
                        {row.sign} {fmt(row.value)} F
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 bg-accent/5 rounded-xl px-4 mt-2 border border-accent/20">
                    <span className="font-bold">Montant attendu en caisse</span>
                    <span className="font-mono font-extrabold text-xl text-accent">
                      {fmt(live?.montantAttendu ?? 0)} F
                    </span>
                  </div>
                </div>

                {/* Détail par mode de paiement */}
                <div>
                  <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">
                    Détail ventes par mode de paiement
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Espèces",      icon: "💵", value: live?.ventesEspeces ?? 0 },
                      { label: "Mobile Money", icon: "📱", value: live?.ventesMobileMoney ?? 0 },
                      { label: "Virement",     icon: "🏦", value: live?.ventesVirement ?? 0 },
                      { label: "Chèque",       icon: "📝", value: live?.ventesCheque ?? 0 },
                    ].map((m, i) => (
                      <div key={i} className="bg-surface2 rounded-xl px-4 py-3 text-center">
                        <p className="text-xl mb-1">{m.icon}</p>
                        <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">{m.label}</p>
                        <p className="font-mono font-bold text-sm">{fmt(m.value)} F</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ── PAS DE SESSION ACTIVE ─── */
            <div className="card p-10 text-center border-dashed border-2 border-border">
              <div className="w-16 h-16 rounded-2xl bg-surface2 border border-border mx-auto mb-4
                              flex items-center justify-center text-3xl">
                🔒
              </div>
              <h2 className="text-xl font-bold mb-2">Caisse fermée</h2>
              <p className="text-muted text-sm mb-6 max-w-sm mx-auto">
                Aucune session de caisse ouverte pour{" "}
                <span className="text-white font-semibold">
                  {boutiques.find(b => b._id === boutiqueId)?.nom ?? "cette boutique"}
                </span>.
                Ouvrez une session pour commencer la journée.
              </p>
              <button onClick={() => setShowOuverture(true)} className="btn-primary">
                🟢 Ouvrir la caisse
              </button>
            </div>
          )}

          {/* ── HISTORIQUE ─────────────────────────────────── */}
          {historique.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Historique des sessions</h2>
                <span className="text-xs font-mono text-muted">10 dernières sessions</span>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ouvert par</th>
                      <th>Durée</th>
                      <th>Ventes</th>
                      <th>Attendu</th>
                      <th>Réel</th>
                      <th>Écart</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historique.map(s => {
                      const dureeMs = s.dateFermeture
                        ? new Date(s.dateFermeture).getTime() - new Date(s.dateOuverture).getTime()
                        : null;
                      const dureeStr = dureeMs
                        ? `${Math.floor(dureeMs / 3600000)}h${Math.floor((dureeMs % 3600000) / 60000)}min`
                        : "En cours";

                      return (
                        <tr key={s._id}>
                          <td className="font-mono text-xs text-muted">
                            {new Date(s.dateOuverture).toLocaleDateString("fr-FR")}
                            <span className="block text-[10px]">
                              {new Date(s.dateOuverture).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td className="text-sm">{s.ouvertPar?.nom}</td>
                          <td className="font-mono text-sm text-muted">{dureeStr}</td>
                          <td className="font-mono text-sm">{fmt(s.totalVentes)} F</td>
                          <td className="font-mono text-sm">{s.montantAttendu > 0 ? fmt(s.montantAttendu) + " F" : "—"}</td>
                          <td className="font-mono text-sm">{s.montantReelTotal > 0 ? fmt(s.montantReelTotal) + " F" : "—"}</td>
                          <td>
                            {s.statut === "fermee" ? (
                              <span className={clsx(
                                "font-mono text-sm font-bold",
                                s.ecart === 0 ? "text-success"
                                : s.ecart > 0 ? "text-warning"
                                : "text-danger"
                              )}>
                                {s.ecart > 0 ? "+" : ""}{fmt(s.ecart)} F
                              </span>
                            ) : <span className="text-muted text-xs">—</span>}
                          </td>
                          <td>
                            <span className={s.statut === "ouverte" ? "badge-green" : "badge-blue"}>
                              {s.statut === "ouverte" ? "🟢 Ouverte" : "✓ Fermée"}
                            </span>
                          </td>
                          <td>
                            <Link href={`/caisse/${s._id}`} className="btn-ghost btn-sm">
                              📄 Rapport
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showOuverture && (
        <OuvertureCaisseModal
          boutiqueId={boutiqueId}
          boutiqueName={boutiques.find(b => b._id === boutiqueId)?.nom ?? ""}
          onClose={() => setShowOuverture(false)}
          onSaved={() => { setShowOuverture(false); fetchSession(); }}
        />
      )}

      {showFermeture && session && live && (
        <FermetureCaisseModal
          session={session}
          live={live}
          onClose={() => setShowFermeture(false)}
          onSaved={() => { setShowFermeture(false); fetchSession(); }}
        />
      )}
    </div>
  );
}
