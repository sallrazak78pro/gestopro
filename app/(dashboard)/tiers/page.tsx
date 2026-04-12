// app/(dashboard)/tiers/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import NouveauTiersModal from "@/components/tresorerie/NouveauTiersModal";
import Pagination from "@/components/ui/Pagination";
import MouvementArgentModal from "@/components/tresorerie/MouvementArgentModal";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function TiersPage() {
  const [tiers, setTiers]         = useState<any[]>([]);
  const [stats, setStats]         = useState({ totalSoldes: 0, nbComptes: 0, nbActifs: 0 });
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [filtreBoutique, setFiltreBoutique] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [opTiers, setOpTiers]     = useState<{ tiersId: string; type: string } | null>(null);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const LIMIT = 25;

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search)         params.set("search",   search);
    if (filtreBoutique) params.set("boutique", filtreBoutique);
    const res  = await fetch(`/api/tiers?${params}`);
    const json = await res.json();
    if (json.success) { setTiers(json.data); setStats(json.stats); setTotal(json.pagination?.total ?? 0); }
    setLoading(false);
  }, [search, filtreBoutique, page]);

  useEffect(() => { fetchTiers(); }, [fetchTiers]);
  useEffect(() => { setPage(1); }, [search, filtreBoutique]);
  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data.filter((b: any) => b.type === "boutique")));
  }, []);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Comptes tiers" value={String(stats.nbComptes)} change="Personnes enregistrées" trend="up" icon="👥" />
        <KpiCard label="Total des soldes" value={fmt(stats.totalSoldes) + " F"} change="Argent gardé en boutique" trend="up" icon="💰" />
        <KpiCard label="Comptes actifs" value={String(stats.nbActifs)} change="Solde > 0" trend={stats.nbActifs > 0 ? "up" : "neutral"} icon="✅" />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Comptes tiers</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Personnes qui gardent leur argent en boutique
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input w-44" placeholder="🔍  Nom ou téléphone..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="select w-40" value={filtreBoutique} onChange={e => setFiltreBoutique(e.target.value)}>
              <option value="">Toutes boutiques</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
            <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + Nouveau compte
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
          ) : tiers.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-4xl">👥</p>
              <p className="text-muted font-mono text-sm">Aucun compte tiers enregistré</p>
              <button className="btn-primary btn-sm mt-2" onClick={() => setShowCreate(true)}>Créer le premier compte</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th>Boutique</th>
                  <th>Solde actuel</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(t => (
                  <tr key={t._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center
                                        justify-center text-xs font-bold text-white shrink-0">
                          {t.nom.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold">{t.nom}</span>
                      </div>
                    </td>
                    <td className="font-mono text-sm text-muted">{t.telephone || "—"}</td>
                    <td className="text-sm text-muted2">{t.boutique?.nom}</td>
                    <td>
                      <span className={clsx("font-mono font-extrabold text-base",
                        t.solde === 0 ? "text-muted" : "text-accent")}>
                        {fmt(t.solde)} F
                      </span>
                    </td>
                    <td>
                      {t.solde > 0
                        ? <span className="badge-green">Actif</span>
                        : <span className="badge-orange">Solde vide</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setOpTiers({ tiersId: t._id, type: "depot_tiers" })}
                          className="btn-success btn-sm">↓ Dépôt</button>
                        <button
                          onClick={() => setOpTiers({ tiersId: t._id, type: "retrait_tiers" })}
                          disabled={t.solde === 0}
                          className="btn-danger btn-sm disabled:opacity-40">↑ Retrait</button>
                        <a href={`/tiers/${t._id}`} className="btn-ghost btn-sm">👁</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && (
          <Pagination page={page} total={total} limit={LIMIT} onChange={p => setPage(p)} />
        )}
      </div>

      {showCreate && (
        <NouveauTiersModal
          boutiques={boutiques}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchTiers(); }}
        />
      )}

      {opTiers && (
        <MouvementArgentModal
          defaultType={opTiers.type}
          onClose={() => setOpTiers(null)}
          onSaved={() => { setOpTiers(null); fetchTiers(); }}
        />
      )}
    </div>
  );
}
