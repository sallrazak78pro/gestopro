// app/(dashboard)/ventes/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import NouvelleVenteModal from "@/components/ventes/NouvelleVenteModal";
import ExportButton from "@/components/ui/ExportButton";
import Pagination from "@/components/ui/Pagination";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const STATUT_BADGE: Record<string, string> = {
  payee: "badge-green", en_attente: "badge-orange", annulee: "badge-red",
};
const STATUT_LABEL: Record<string, string> = {
  payee: "Payée", en_attente: "En attente", annulee: "Annulée",
};
const MODE_ICON: Record<string, string> = {
  especes: "💵", mobile_money: "📱", virement: "🏦", cheque: "📝",
};

export default function VentesPage() {
  const [ventes,   setVentes]   = useState<any[]>([]);
  const [stats,    setStats]    = useState({ totalCA: 0, nbPayees: 0, nbAttente: 0, total: 0 });
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [search,   setSearch]   = useState("");
  const [filtreStatut,   setFiltreStatut]   = useState("");
  const [filtreBoutique, setFiltreBoutique] = useState("");
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [page,  setPage]  = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;

  const fetchVentes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filtreStatut)   params.set("statut",   filtreStatut);
    if (filtreBoutique) params.set("boutique", filtreBoutique);
    const res  = await fetch(`/api/ventes?${params}`);
    const json = await res.json();
    if (json.success) {
      setVentes(json.data);
      setStats(json.stats);
      setTotal(json.pagination?.total ?? 0);
    }
    setLoading(false);
  }, [filtreStatut, filtreBoutique, page]);

  useEffect(() => { fetchVentes(); }, [fetchVentes]);
  useEffect(() => { setPage(1); }, [filtreStatut, filtreBoutique]);
  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data.filter((b: any) => b.type === "boutique")));
  }, []);

  const filtered = ventes.filter(v =>
    v.reference?.toLowerCase().includes(search.toLowerCase()) ||
    v.client?.toLowerCase().includes(search.toLowerCase())
  );

  const tauxRecouvrement = stats.total > 0 ? ((stats.nbPayees / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="CA total" value={fmt(stats.totalCA) + " F"} change="Ventes payées uniquement" trend="up" icon="💰" />
        <KpiCard label="Nb factures" value={String(stats.total)} change="Période sélectionnée" trend="up" icon="🧾" />
        <KpiCard label="En attente" value={String(stats.nbAttente)} change="À encaisser" trend={stats.nbAttente > 0 ? "neutral" : "up"} icon="⏳" />
        <KpiCard label="Taux recouvrement" value={tauxRecouvrement + "%"} change={`${stats.nbPayees} sur ${stats.total} payées`} trend={+tauxRecouvrement >= 80 ? "up" : "down"} icon="✅" />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Factures & Ventes</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Historique complet des transactions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input w-44" placeholder="🔍  Réf. ou client..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="select w-36" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="payee">Payées</option>
              <option value="en_attente">En attente</option>
              <option value="annulee">Annulées</option>
            </select>
            <select className="select w-40" value={filtreBoutique} onChange={e => setFiltreBoutique(e.target.value)}>
              <option value="">Toutes boutiques</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
            <ExportButton type="ventes" />
            <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}>
              + Nouvelle vente
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted font-mono text-sm gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-3xl">🧾</p>
              <p className="text-muted font-mono text-sm">Aucune vente trouvée</p>
              <button className="btn-primary btn-sm mt-2" onClick={() => setShowModal(true)}>
                Créer la première vente
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Boutique</th>
                  <th>Paiement</th><th>Employé</th><th>Montant</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v._id}>
                    <td className="font-mono text-xs text-accent">{v.reference}</td>
                    <td className="font-mono text-xs text-muted">
                      {new Date(v.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="font-semibold">{v.client}</td>
                    <td className="text-xs text-muted2">{v.boutique?.nom}</td>
                    <td>
                      <span className="text-sm">{MODE_ICON[v.modePaiement]}</span>
                      <span className="text-xs text-muted2 ml-1 capitalize">{v.modePaiement.replace("_", " ")}</span>
                    </td>
                      <td>
                        <p className="text-sm">{v.employe?.nom || v.employeNom || "—"}</p>
                      </td>
                    <td className="font-mono font-bold">{fmt(v.montantTotal)} F</td>
                    <td><span className={STATUT_BADGE[v.statut]}>{STATUT_LABEL[v.statut]}</span></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/ventes/${v._id}`} className="btn-ghost btn-sm">👁</Link>
                        {v.statut === "en_attente" && (
                          <button onClick={async () => {
                            await fetch(`/api/ventes/${v._id}`, {
                              method: "PUT", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ statut: "payee" }),
                            });
                            fetchVentes();
                          }} className="btn-success btn-sm">✓ Encaisser</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && (
          <Pagination page={page} total={total} limit={LIMIT} onChange={p => { setPage(p); }} />
        )}
      </div>

      {showModal && (
        <NouvelleVenteModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchVentes(); }}
        />
      )}
    </div>
  );
}
