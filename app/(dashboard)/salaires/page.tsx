// app/(dashboard)/salaires/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import PaiementSalaireModal from "@/components/employes/PaiementSalaireModal";
import clsx from "clsx";
import PrintButton from "@/components/ui/PrintButton";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const MOIS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function SalairesPage() {
  const now = new Date();
  const [mois, setMois]         = useState(now.getMonth() + 1);
  const [annee, setAnnee]       = useState(now.getFullYear());
  const [employes, setEmployes] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [employeAPayer, setEmployeAPayer] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [empRes, salRes] = await Promise.all([
      fetch("/api/employes?actif=true"),
      fetch(`/api/salaires?mois=${mois}&annee=${annee}`),
    ]);
    const [empJson, salJson] = await Promise.all([empRes.json(), salRes.json()]);
    if (empJson.success) setEmployes(empJson.data);
    if (salJson.success) setPaiements(salJson.data);
    setLoading(false);
  }, [mois, annee]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    fetch("/api/boutiques?type=boutique").then(r => r.json())
      .then(j => j.success && setBoutiques(j.data));
  }, []);

  // Calculer l'état de chaque employé pour ce mois
  const employesAvecStatut = employes.map(e => {
    const paiement = paiements.find(p => p.employe?._id === e._id || p.employe === e._id);
    return { ...e, paiement, estPaye: !!paiement };
  });

  const nbPayes    = employesAvecStatut.filter(e => e.estPaye).length;
  const nbEnAttente= employesAvecStatut.filter(e => !e.estPaye).length;
  const totalPaye  = paiements.reduce((s, p) => s + p.montantNet, 0);
  const totalRestant = employes
    .filter(e => !employesAvecStatut.find(ea => ea._id === e._id)?.estPaye)
    .reduce((s, e) => s + e.salaireBase, 0);

  const ANNEES = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">

      {/* Sélecteur de période */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="select w-36" value={mois} onChange={e => setMois(+e.target.value)}>
          {MOIS.slice(1).map((m, i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <select className="select w-28" value={annee} onChange={e => setAnnee(+e.target.value)}>
          {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs font-mono text-muted">Payé</span>
          <div className="w-2 h-2 rounded-full bg-warning ml-2" />
          <span className="text-xs font-mono text-muted">En attente</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Déjà payés"    value={`${nbPayes} / ${employes.length}`}    change={MOIS[mois] + " " + annee}  trend="up"      icon="✅" />
        <KpiCard label="En attente"    value={String(nbEnAttente)}                   change="À payer ce mois"             trend={nbEnAttente > 0 ? "neutral" : "up"} icon="⏳" />
        <KpiCard label="Total versé"   value={fmt(totalPaye) + " F"}                 change="Ce mois"                    trend="up"      icon="💸" />
        <KpiCard label="Reste à payer" value={fmt(totalRestant) + " F"}              change="Estimation"                 trend={totalRestant > 0 ? "down" : "up"} icon="💰" />
      </div>

      {/* Tableau par employé */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Salaires — {MOIS[mois]} {annee}</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              État des paiements pour la période
            </p>
          </div>
          <button onClick={fetchAll} className="btn-ghost btn-sm">🔄</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted font-mono text-sm gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Chargement...
          </div>
        ) : employes.length === 0 ? (
          <div className="text-center py-16 text-muted font-mono text-sm">
            Aucun employé actif. Ajoutez des employés d'abord.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Employé</th>
                  <th>Poste</th>
                  <th>Boutique</th>
                  <th>Salaire base</th>
                  <th>Avances</th>
                  <th>Net à payer</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {employesAvecStatut.map(e => {
                  const p = e.paiement;
                  return (
                    <tr key={e._id} className={clsx(!e.estPaye && "bg-warning/[0.02]")}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2
                                          flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {e.prenom.charAt(0)}{e.nom.charAt(0)}
                          </div>
                          <span className="font-semibold text-sm">{e.prenom} {e.nom}</span>
                        </div>
                      </td>
                      <td><span className="badge-purple text-xs">{e.poste}</span></td>
                      <td className="text-sm text-muted2">{e.boutique?.nom}</td>
                      <td className="font-mono text-sm">{fmt(e.salaireBase)} F</td>
                      <td>
                        {p ? (
                          p.totalAvances > 0
                            ? <span className="font-mono text-sm text-warning">−{fmt(p.totalAvances)} F</span>
                            : <span className="text-muted text-xs font-mono">—</span>
                        ) : (
                          <span className="text-muted text-xs font-mono">—</span>
                        )}
                      </td>
                      <td>
                        {p ? (
                          <span className="font-mono font-bold text-success">{fmt(p.montantNet)} F</span>
                        ) : (
                          <span className="font-mono text-sm text-muted">{fmt(e.salaireBase)} F</span>
                        )}
                      </td>
                      <td>
                        {e.estPaye ? (
                          <div>
                            <span className="badge-green">✓ Payé</span>
                            <p className="text-[10px] font-mono text-muted mt-0.5">
                              {new Date(p.datePaiement).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        ) : (
                          <span className="badge-orange">En attente</span>
                        )}
                      </td>
                      <td>
                        {!e.estPaye ? (
                          <button
                            onClick={() => { setEmployeAPayer(e); setShowModal(true); }}
                            className="btn-success btn-sm">
                            💸 Payer
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted">{p.reference}</span>
                            <PrintButton href={`/print/salaire/${p._id}`} label="🖨️" size="sm" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && employeAPayer && (
        <PaiementSalaireModal
          employe={employeAPayer}
          mois={mois}
          annee={annee}
          boutiques={boutiques}
          onClose={() => { setShowModal(false); setEmployeAPayer(null); }}
          onSaved={() => { setShowModal(false); setEmployeAPayer(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
