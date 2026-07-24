// app/(dashboard)/caisse/page.tsx
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import OuvertureCaisseModal from "@/components/caisse/OuvertureCaisseModal";
import FermetureCaisseModal from "@/components/caisse/FermetureCaisseModal";
import { useAppData } from "@/lib/context/AppDataContext";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0));

function dureeSession(depuis: string) {
  const diff = Date.now() - new Date(depuis).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

interface CaisseInfo {
  boutique: any;
  session: any | null;
  live: any | null;
  soldeCaisse: number;
}

export default function CaissePage() {
  const { data: authSession } = useSession();
  const boutiqueAssignee = (authSession?.user as any)?.boutique;

  const { boutiques: boutiquesToutes } = useAppData();
  const boutiques = useMemo(() => boutiquesToutes.filter((b: any) => b.type === "boutique"), [boutiquesToutes]);
  // Admin/gestionnaire global → toutes les boutiques ; utilisateur assigné → uniquement la sienne.
  const accessibles = useMemo(
    () => boutiqueAssignee ? boutiques.filter((b: any) => b._id === boutiqueAssignee) : boutiques,
    [boutiques, boutiqueAssignee]
  );

  const [caisses, setCaisses]   = useState<Record<string, CaisseInfo>>({});
  const [loading, setLoading]   = useState(true);
  const [historique, setHistorique] = useState<any[]>([]);
  const [modalBoutique, setModalBoutique] = useState<{ id: string; nom: string } | null>(null);
  const [showFermeture, setShowFermeture] = useState<CaisseInfo | null>(null);

  const fetchTout = useCallback(async () => {
    if (accessibles.length === 0) return;
    setLoading(true);

    const [caissesArr, histArrs] = await Promise.all([
      Promise.all(accessibles.map(async (b: any) => {
        const [activeRes, soldeRes] = await Promise.all([
          fetch(`/api/sessions-caisse/active?boutiqueId=${b._id}`).then(r => r.json()),
          fetch(`/api/tresorerie/solde?boutiqueId=${b._id}`).then(r => r.json()),
        ]);
        return {
          boutique: b,
          session: activeRes.success ? activeRes.data?.session ?? null : null,
          live:    activeRes.success ? activeRes.data?.live ?? null    : null,
          soldeCaisse: soldeRes.success ? soldeRes.data?.soldeCaisse ?? 0 : 0,
        } as CaisseInfo;
      })),
      Promise.all(accessibles.map((b: any) =>
        fetch(`/api/sessions-caisse?boutique=${b._id}&limit=5`).then(r => r.json())
          .then(j => (j.success ? j.data : []).map((s: any) => ({ ...s, boutique: s.boutique ?? b })))
      )),
    ]);

    const map: Record<string, CaisseInfo> = {};
    caissesArr.forEach(c => { map[c.boutique._id] = c; });
    setCaisses(map);

    const hist = histArrs.flat()
      .sort((a, b) => new Date(b.dateOuverture).getTime() - new Date(a.dateOuverture).getTime())
      .slice(0, 15);
    setHistorique(hist);

    setLoading(false);
  }, [accessibles]);

  useEffect(() => { fetchTout(); }, [fetchTout]);

  return (
    <div className="space-y-6">

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted font-mono text-sm gap-3">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Chargement des caisses...
        </div>
      ) : accessibles.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-muted font-mono text-sm">Aucune boutique accessible</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accessibles.map((b: any) => {
            const c = caisses[b._id];
            const ouverte = !!c?.session;
            const entrees = ouverte ? (c.live?.totalVentes ?? 0) + (c.live?.totalEntrees ?? 0) : 0;

            return (
              <div key={b._id} className={clsx("card p-5", ouverte ? "border-success/40 bg-success/5" : "")}>
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-base font-bold">{b.nom}</h2>
                      <span className={ouverte ? "badge-green text-xs" : "badge-blue text-xs"}>
                        {ouverte ? "🟢 Ouverte" : "🔒 Fermée"}
                      </span>
                    </div>
                    {ouverte ? (
                      <p className="text-xs text-muted2">
                        Ouverte par <span className="font-semibold text-white">{c.session.ouvertPar?.nom}</span>
                        {" "}· depuis <span className="font-mono text-accent">{dureeSession(c.session.dateOuverture)}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted font-mono">Aucune session en cours</p>
                    )}
                  </div>
                  <button
                    onClick={() => ouverte ? setShowFermeture(c) : setModalBoutique({ id: b._id, nom: b.nom })}
                    className={ouverte ? "btn-danger btn-sm shrink-0" : "btn-primary btn-sm shrink-0"}>
                    {ouverte ? "🔒 Fermer" : "🟢 Ouvrir"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface2 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">💼 Fond d&apos;ouverture</p>
                    <p className="font-mono font-bold text-sm">{ouverte ? fmt(c.session.fondOuverture) + " F" : "—"}</p>
                  </div>
                  <div className="bg-surface2 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">📥 Entrées (ventes incl.)</p>
                    <p className="font-mono font-bold text-sm text-success">{ouverte ? fmt(entrees) + " F" : "—"}</p>
                  </div>
                  <div className="bg-surface2 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">📤 Sorties d&apos;argent</p>
                    <p className="font-mono font-bold text-sm text-danger">{ouverte ? fmt(c.live?.totalSorties ?? 0) + " F" : "—"}</p>
                  </div>
                  <div className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">💰 Montant physique</p>
                    <p className="font-mono font-extrabold text-sm text-accent">{fmt(c?.soldeCaisse ?? 0)} F</p>
                  </div>
                </div>

                {c?.session && (
                  <Link href={`/caisse/${c.session._id}`} className="btn-ghost btn-sm mt-3 w-full justify-center">
                    📄 Voir le rapport détaillé
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORIQUE ─────────────────────────────────── */}
      {historique.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Historique des sessions</h2>
            <span className="text-xs font-mono text-muted">15 dernières sessions</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Boutique</th>
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
                      <td className="text-sm">{s.boutique?.nom}</td>
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

      {/* Modals */}
      {modalBoutique && (
        <OuvertureCaisseModal
          boutiqueId={modalBoutique.id}
          boutiqueName={modalBoutique.nom}
          onClose={() => setModalBoutique(null)}
          onSaved={() => { setModalBoutique(null); fetchTout(); }}
        />
      )}

      {showFermeture?.session && showFermeture?.live && (
        <FermetureCaisseModal
          session={showFermeture.session}
          live={showFermeture.live}
          onClose={() => setShowFermeture(null)}
          onSaved={() => { setShowFermeture(null); fetchTout(); }}
        />
      )}
    </div>
  );
}
