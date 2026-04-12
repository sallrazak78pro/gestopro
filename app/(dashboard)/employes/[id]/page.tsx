// app/(dashboard)/employes/[id]/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AvanceModal from "@/components/employes/AvanceModal";
import clsx from "clsx";
import PrintButton from "@/components/ui/PrintButton";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const MOIS = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function EmployeDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [showAvance, setShowAvance] = useState(false);
  const [boutiques, setBoutiques]   = useState<any[]>([]);
  const now = new Date();

  const fetchData = useCallback(async () => {
    const res  = await fetch(`/api/employes/${id}`);
    const json = await res.json();
    if (json.success) setData(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    fetch("/api/boutiques?type=boutique").then(r => r.json())
      .then(j => j.success && setBoutiques(j.data));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted font-mono text-sm gap-3">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Chargement...
    </div>
  );
  if (!data) return <div className="text-center py-20 text-muted font-mono">Employé introuvable</div>;

  const { employe, avancesEnAttente, paiements } = data;
  const totalAvancesEnAttente = avancesEnAttente.reduce((s: number, a: any) => s + a.montant, 0);
  const moisCourant = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();
  const avancesCeMois = avancesEnAttente.filter((a: any) =>
    a.moisDeduction === moisCourant && a.anneeDeduction === anneeCourante
  );
  const totalAvancesCeMois = avancesCeMois.reduce((s: number, a: any) => s + a.montant, 0);
  const salaireNetEstime = Math.max(0, employe.salaireBase - totalAvancesCeMois);

  // Calcul ancienneté
  const debut = new Date(employe.dateEmbauche);
  const diffMs = now.getTime() - debut.getTime();
  const annees = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
  const moisR  = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => router.back()} className="btn-ghost btn-sm">← Retour</button>

      {/* Fiche employé */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent2
                          flex items-center justify-center text-2xl font-extrabold text-white shrink-0">
            {employe.prenom.charAt(0)}{employe.nom.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight">{employe.prenom} {employe.nom}</h1>
              <span className="badge-purple">{employe.poste}</span>
              {employe.actif ? <span className="badge-green">✓ Actif</span> : <span className="badge-red">Inactif</span>}
            </div>
            <p className="text-sm text-muted2 mb-3">{employe.boutique?.nom}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Téléphone",    value: employe.telephone || "—" },
                { label: "Date embauche",value: new Date(employe.dateEmbauche).toLocaleDateString("fr-FR") },
                { label: "Ancienneté",   value: annees > 0 ? `${annees} an${annees > 1 ? "s" : ""} ${moisR}m` : `${moisR} mois` },
                { label: "CNI",          value: employe.cni || "—" },
              ].map((info, i) => (
                <div key={i} className="bg-surface2 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">{info.label}</p>
                  <p className="text-sm font-semibold">{info.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Salaire */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="kpi-label">Salaire de base</p>
          <p className="text-2xl font-extrabold font-mono text-white">{fmt(employe.salaireBase)} F</p>
          <p className="text-xs font-mono text-muted mt-1">Brut mensuel</p>
        </div>
        <div className={clsx("card p-5 text-center border-2", totalAvancesCeMois > 0 ? "border-warning/40" : "border-border")}>
          <p className="kpi-label">Avances ce mois</p>
          <p className={clsx("text-2xl font-extrabold font-mono", totalAvancesCeMois > 0 ? "text-warning" : "text-muted")}>
            {totalAvancesCeMois > 0 ? "−" : ""}{fmt(totalAvancesCeMois)} F
          </p>
          <p className="text-xs font-mono text-muted mt-1">{MOIS[moisCourant]} {anneeCourante}</p>
        </div>
        <div className="card p-5 text-center border-2 border-success/30 bg-success/5">
          <p className="kpi-label">Net estimé</p>
          <p className="text-2xl font-extrabold font-mono text-success">{fmt(salaireNetEstime)} F</p>
          <p className="text-xs font-mono text-muted mt-1">Après déduction avances</p>
        </div>
      </div>

      {/* Avances en attente */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Avances sur salaire en attente</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">Non encore déduites du salaire</p>
          </div>
          <div className="flex items-center gap-2">
            {totalAvancesEnAttente > 0 && (
              <span className="badge-orange font-mono">{fmt(totalAvancesEnAttente)} F total</span>
            )}
            <button className="btn-primary btn-sm" onClick={() => setShowAvance(true)}>
              + Avance
            </button>
          </div>
        </div>
        {avancesEnAttente.length === 0 ? (
          <div className="text-center py-10 text-muted font-mono text-sm">
            Aucune avance en attente
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Montant</th><th>Motif</th><th>Déduction prévue</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {avancesEnAttente.map((a: any) => (
                  <tr key={a._id}>
                    <td className="font-mono text-xs text-muted">{new Date(a.date).toLocaleDateString("fr-FR")}</td>
                    <td className="font-mono font-bold text-warning">{fmt(a.montant)} F</td>
                    <td className="text-sm">{a.motif || "—"}</td>
                    <td className="text-sm font-mono">{MOIS[a.moisDeduction]} {a.anneeDeduction}</td>
                    <td><span className="badge-orange">En attente</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historique paiements */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Historique des salaires</h2>
          <span className="text-xs font-mono text-muted">12 derniers mois</span>
        </div>
        {paiements.length === 0 ? (
          <div className="text-center py-10 text-muted font-mono text-sm">Aucun paiement enregistré</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th><th>Période</th><th>Base</th><th>Avances déduites</th>
                  <th>Net payé</th><th>Mode</th><th>Date paiement</th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((p: any) => (
                  <tr key={p._id}>
                    <td className="font-mono text-xs text-accent">{p.reference}</td>
                    <td className="font-semibold">{MOIS[p.mois]} {p.annee}</td>
                    <td className="font-mono text-sm">{fmt(p.salaireBase)} F</td>
                    <td className={clsx("font-mono text-sm", p.totalAvances > 0 ? "text-warning" : "text-muted")}>
                      {p.totalAvances > 0 ? `−${fmt(p.totalAvances)} F` : "—"}
                    </td>
                    <td className="font-mono font-bold text-success">{fmt(p.montantNet)} F</td>
                    <td className="text-xs text-muted capitalize">{p.modePaiement.replace("_"," ")}</td>
                    <td className="font-mono text-xs text-muted">
                      {new Date(p.datePaiement).toLocaleDateString("fr-FR")}
                    </td>
                    <td>
                      <PrintButton href={`/print/salaire/${p._id}`} label="🖨️" size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAvance && (
        <AvanceModal
          employe={employe}
          boutiques={boutiques}
          onClose={() => setShowAvance(false)}
          onSaved={() => { setShowAvance(false); fetchData(); }}
        />
      )}
    </div>
  );
}
