// app/(dashboard)/mouvements/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import NouveauMouvementModal from "@/components/mouvements/NouveauMouvementModal";
import Pagination from "@/components/ui/Pagination";
import clsx from "clsx";

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const TYPE_CONFIG: Record<string, { label: string; icon: string; badge: string }> = {
  depot_vers_boutique:    { label: "Dépôt → Boutique",   icon: "🏭→🏪", badge: "badge-blue"   },
  boutique_vers_boutique: { label: "Boutique → Boutique", icon: "🏪→🏪", badge: "badge-purple" },
  entree_fournisseur:     { label: "Entrée fournisseur",  icon: "📦→🏭", badge: "badge-green"  },
  sortie_perte:           { label: "Sortie / Perte",      icon: "🗑️",   badge: "badge-red"    },
};

const STATUT_CONFIG: Record<string, { label: string; badge: string }> = {
  en_cours: { label: "En cours", badge: "badge-orange" },
  livre:    { label: "Livré",    badge: "badge-green"  },
  annule:   { label: "Annulé",   badge: "badge-red"    },
};

function defaultDebut() {
  const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
}
function defaultFin() {
  return new Date().toISOString().split("T")[0];
}

export default function MouvementsPage() {
  const { data: session } = useSession();
  const role        = (session?.user as any)?.role ?? "";
  const peutAnnuler = ["admin", "superadmin", "gestionnaire"].includes(role);

  const [mouvements,      setMouvements]      = useState<any[]>([]);
  const [boutiques,       setBoutiques]       = useState<any[]>([]);
  const [page,            setPage]            = useState(1);
  const [total,           setTotal]           = useState(0);
  const [stats,           setStats]           = useState({ total: 0, nbEnTransit: 0, nbEntrees: 0, totalUnites: 0, totalMontant: 0 });
  const [loading,         setLoading]         = useState(true);
  const [showModal,       setShowModal]       = useState(false);
  const [filtreType,      setFiltreType]      = useState("");
  const [filtreStatut,    setFiltreStatut]    = useState("");
  const [filtreBoutique,  setFiltreBoutique]  = useState("");
  const [dateDebut,       setDateDebut]       = useState(defaultDebut);
  const [dateFin,         setDateFin]         = useState(defaultFin);
  const [search,          setSearch]          = useState("");
  const [confirmAnnul,    setConfirmAnnul]    = useState<string | null>(null);
  const [annulLoading,    setAnnulLoading]    = useState<string | null>(null);
  const LIMIT = 25;

  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => { if (j.success) setBoutiques(j.data); });
  }, []);

  const fetchMouvements = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filtreType)    p.set("type",      filtreType);
    if (filtreStatut)  p.set("statut",    filtreStatut);
    if (filtreBoutique)p.set("boutique",  filtreBoutique);
    if (dateDebut)     p.set("dateDebut", dateDebut);
    if (dateFin)       p.set("dateFin",   dateFin);
    const res  = await fetch(`/api/mouvements-stock?${p}`);
    const json = await res.json();
    if (json.success) {
      setMouvements(json.data);
      setStats(json.stats);
      setTotal(json.pagination?.total ?? 0);
    }
    setLoading(false);
  }, [filtreType, filtreStatut, filtreBoutique, dateDebut, dateFin, page]);

  useEffect(() => { fetchMouvements(); }, [fetchMouvements]);
  useEffect(() => { setPage(1); }, [filtreType, filtreStatut, filtreBoutique, dateDebut, dateFin]);

  const filtered = mouvements.filter(m =>
    !search ||
    m.reference?.toLowerCase().includes(search.toLowerCase()) ||
    m.produit?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    m.source?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    m.destination?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  async function annuler(id: string) {
    setAnnulLoading(id);
    await fetch(`/api/mouvements-stock/${id}`, { method: "PUT" });
    setAnnulLoading(null);
    setConfirmAnnul(null);
    fetchMouvements();
  }

  const hasFilters = filtreType || filtreStatut || filtreBoutique ||
    dateDebut !== defaultDebut() || dateFin !== defaultFin();

  return (
    <div className="space-y-6">

      {/* ── KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Total période</p>
          <p className="text-3xl font-extrabold mt-1" style={{ color: "var(--color-fg)" }}>{fmt(stats.total)}</p>
          <p className="text-[11px] font-mono text-muted mt-1">mouvements</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">En transit</p>
          <p className="text-3xl font-extrabold mt-1" style={{ color: stats.nbEnTransit > 0 ? "#f59e0b" : "var(--color-fg)" }}>
            {fmt(stats.nbEnTransit)}
          </p>
          <p className="text-[11px] font-mono text-muted mt-1">en attente</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Entrées</p>
          <p className="text-3xl font-extrabold mt-1" style={{ color: "#10b981" }}>{fmt(stats.nbEntrees)}</p>
          <p className="text-[11px] font-mono text-muted mt-1">fournisseurs</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Unités déplacées</p>
          <p className="text-3xl font-extrabold mt-1" style={{ color: "#00d4ff" }}>{fmt(stats.totalUnites)}</p>
          <p className="text-[11px] font-mono text-muted mt-1">articles</p>
        </div>
        <div className="card p-5 col-span-2 xl:col-span-1">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Valeur déplacée</p>
          <p className="text-2xl font-extrabold mt-1" style={{ color: "#7c3aed" }}>{fmt(stats.totalMontant)}</p>
          <p className="text-[11px] font-mono text-muted mt-1">FCFA (prix achat)</p>
        </div>
      </div>

      {/* ── Journal ──────────────────────────────────────────────── */}
      <div className="card">

        {/* Header */}
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Journal des mouvements</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Déplacements de marchandise · {dateDebut} → {dateFin}
            </p>
          </div>
          <button className="btn-primary btn-sm ml-auto" onClick={() => setShowModal(true)}>
            + Nouveau mouvement
          </button>
        </div>

        {/* ── Filtres ───────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-border bg-surface2/30">
          <div className="flex flex-wrap gap-3 items-end">

            <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Recherche</label>
              <input className="input" placeholder="Réf., produit, boutique..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Type</label>
              <select className="select w-44" value={filtreType} onChange={e => setFiltreType(e.target.value)}>
                <option value="">Tous les types</option>
                <option value="depot_vers_boutique">Dépôt → Boutique</option>
                <option value="boutique_vers_boutique">Boutique → Boutique</option>
                <option value="entree_fournisseur">Entrée fournisseur</option>
                <option value="sortie_perte">Sortie / Perte</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Boutique</label>
              <select className="select w-44" value={filtreBoutique} onChange={e => setFiltreBoutique(e.target.value)}>
                <option value="">Toutes boutiques</option>
                {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Statut</label>
              <select className="select w-32" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
                <option value="">Tous</option>
                <option value="en_cours">En cours</option>
                <option value="livre">Livré</option>
                <option value="annule">Annulé</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Du</label>
              <input type="date" className="input" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Au</label>
              <input type="date" className="input" value={dateFin} onChange={e => setDateFin(e.target.value)} />
            </div>

            {(hasFilters || search) && (
              <button
                className="self-end btn-ghost btn-sm text-muted hover:text-danger"
                onClick={() => {
                  setFiltreType(""); setFiltreStatut(""); setFiltreBoutique("");
                  setDateDebut(defaultDebut()); setDateFin(defaultFin()); setSearch("");
                }}
              >↺ Reset</button>
            )}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="table-wrapper">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted font-mono text-sm gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <p className="text-4xl">🔄</p>
              <p className="text-muted font-mono text-sm">Aucun mouvement sur cette période</p>
              <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}>
                + Nouveau mouvement
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Produit</th>
                  <th>De</th>
                  <th>Vers</th>
                  <th className="text-right">Qté</th>
                  <th className="text-right">Montant</th>
                  <th>Statut</th>
                  {peutAnnuler && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const tc      = TYPE_CONFIG[m.type];
                  const sc      = STATUT_CONFIG[m.statut];
                  const montant = m.quantite * (m.produit?.prixAchat ?? 0);
                  const isConfirming = confirmAnnul === m._id;

                  return (
                    <tr key={m._id} className={clsx(m.statut === "annule" && "opacity-40")}>
                      <td className="font-mono text-xs text-accent whitespace-nowrap">{m.reference}</td>
                      <td className="whitespace-nowrap">
                        <p className="font-mono text-xs">{fmtDate(m.createdAt)}</p>
                        <p className="font-mono text-[10px] text-muted">{fmtTime(m.createdAt)}</p>
                      </td>
                      <td>
                        <span className={clsx("text-xs font-mono", tc?.badge ?? "badge-blue")}>
                          {tc?.icon} {tc?.label}
                        </span>
                      </td>
                      <td>
                        <p className="font-semibold text-sm">{m.produit?.nom}</p>
                        <p className="text-[10px] font-mono text-muted">{m.produit?.reference}</p>
                      </td>
                      <td>
                        {m.source
                          ? <><p className="text-sm font-medium">{m.source.nom}</p><p className="text-[10px] font-mono text-muted capitalize">{m.source.type}</p></>
                          : <span className="text-muted text-xs font-mono">Ext.</span>}
                      </td>
                      <td>
                        {m.destination
                          ? <><p className="text-sm font-medium">{m.destination.nom}</p><p className="text-[10px] font-mono text-muted capitalize">{m.destination.type}</p></>
                          : <span className="text-muted text-xs font-mono">—</span>}
                      </td>
                      <td className="text-right">
                        <span className="font-mono font-bold text-accent">{fmt(m.quantite)}</span>
                        <span className="text-[10px] text-muted block font-mono">{m.produit?.unite}</span>
                      </td>
                      <td className="text-right">
                        {montant > 0
                          ? <span className="font-mono text-sm font-semibold">{fmt(montant)} F</span>
                          : <span className="text-muted font-mono text-xs">—</span>}
                      </td>
                      <td><span className={sc?.badge}>{sc?.label}</span></td>
                      {peutAnnuler && (
                        <td>
                          {m.statut !== "annule" && (
                            isConfirming ? (
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="text-[11px] font-mono text-warning">Confirmer ?</span>
                                <button
                                  onClick={() => annuler(m._id)}
                                  disabled={annulLoading === m._id}
                                  className="btn-danger btn-sm text-xs px-2 disabled:opacity-50"
                                >
                                  {annulLoading === m._id ? "..." : "Oui"}
                                </button>
                                <button
                                  onClick={() => setConfirmAnnul(null)}
                                  className="btn-ghost btn-sm text-xs px-2"
                                >Non</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmAnnul(m._id)}
                                className="btn-ghost btn-sm text-danger/70 hover:text-danger text-xs"
                              >✕ Annuler</button>
                            )
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && total > 0 && (
          <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-6 text-xs font-mono text-muted">
              <span>{total} mouvement{total > 1 ? "s" : ""} au total</span>
              <span>·</span>
              <span>Valeur période : <strong className="text-accent">{fmt(stats.totalMontant)} F</strong></span>
            </div>
            <button onClick={fetchMouvements} className="btn-ghost btn-sm">🔄 Actualiser</button>
          </div>
        )}
      </div>

      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />

      {showModal && (
        <NouveauMouvementModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchMouvements(); }}
        />
      )}
    </div>
  );
}
