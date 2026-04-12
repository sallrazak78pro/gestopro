// app/(dashboard)/commandes/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import NouvelleCommandeModal from "@/components/fournisseurs/NouvelleCommandeModal";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  brouillon:           { label: "Brouillon",          badge: "badge-orange", icon: "📝" },
  envoyee:             { label: "Envoyée",             badge: "badge-blue",   icon: "📤" },
  recue_partiellement: { label: "Partielle",           badge: "badge-orange", icon: "📦" },
  recue:               { label: "Reçue",               badge: "badge-green",  icon: "✅" },
  annulee:             { label: "Annulée",             badge: "badge-red",    icon: "✕" },
};

export default function CommandesPage() {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [stats, setStats]         = useState({ total: 0, totalDu: 0 });
  const [loading, setLoading]     = useState(true);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [showModal, setShowModal] = useState(false);

  const fetchC = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtreStatut) params.set("statut", filtreStatut);
    const res = await fetch(`/api/commandes?${params}`);
    const json = await res.json();
    if (json.success) { setCommandes(json.data); setStats(json.stats); }
    setLoading(false);
  }, [filtreStatut]);

  useEffect(() => { fetchC(); }, [fetchC]);

  const now = new Date();
  const enCours    = commandes.filter(c => ["envoyee","recue_partiellement"].includes(c.statut)).length;
  const recuesMois = commandes.filter(c => c.statut === "recue" && new Date(c.dateReception||c.createdAt).getMonth() === now.getMonth()).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Commandes"    value={String(stats.total)}       change="Total"              trend="up"     icon="📋" />
        <KpiCard label="Montant dû"   value={fmt(stats.totalDu) + " F"} change="Reste à payer"      trend={stats.totalDu > 0 ? "down" : "up"} icon="💳" />
        <KpiCard label="En cours"     value={String(enCours)}           change="En attente livraison" trend="neutral" icon="🚚" />
        <KpiCard label="Reçues / mois" value={String(recuesMois)}       change="Ce mois"            trend="up"     icon="✅" />
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Commandes fournisseurs</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">Suivi des achats et réceptions</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="select w-40" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
              <option value="">Tous statuts</option>
              {Object.entries(STATUT_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.icon} {c.label}</option>
              ))}
            </select>
            <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Nouvelle commande</button>
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted font-mono text-sm gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg> Chargement...
            </div>
          ) : commandes.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-4xl">📋</p>
              <p className="text-muted font-mono text-sm">Aucune commande</p>
              <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}>Créer une commande</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Référence</th><th>Date</th><th>Fournisseur</th><th>Destination</th><th>Total</th><th>Payé</th><th>Reste dû</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody>
                {commandes.map(c => {
                  const sc = STATUT_CONFIG[c.statut];
                  return (
                    <tr key={c._id} className={clsx(c.statut === "annulee" && "opacity-50")}>
                      <td className="font-mono text-xs text-accent">{c.reference}</td>
                      <td className="font-mono text-xs text-muted">{new Date(c.dateCommande).toLocaleDateString("fr-FR")}</td>
                      <td><p className="font-semibold text-sm">{c.fournisseur?.nom}</p></td>
                      <td className="text-sm text-muted2">{c.destination?.nom}</td>
                      <td className="font-mono font-bold">{fmt(c.montantTotal)} F</td>
                      <td className="font-mono text-sm text-success">{c.montantPaye > 0 ? fmt(c.montantPaye)+" F" : "—"}</td>
                      <td><span className={c.montantDu > 0 ? "font-mono font-bold text-danger" : "font-mono text-muted"}>{c.montantDu > 0 ? fmt(c.montantDu)+" F" : "✓"}</span></td>
                      <td><span className={sc.badge}>{sc.icon} {sc.label}</span></td>
                      <td><Link href={`/commandes/${c._id}`} className="btn-ghost btn-sm">👁</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && commandes.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex justify-between">
            <p className="text-xs font-mono text-muted">{commandes.length} commande{commandes.length>1?"s":""}</p>
            <button onClick={fetchC} className="btn-ghost btn-sm">🔄</button>
          </div>
        )}
      </div>

      {showModal && (
        <NouvelleCommandeModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchC(); }} />
      )}
    </div>
  );
}
