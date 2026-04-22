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

function defaultDebut() { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; }
function defaultFin()   { return new Date().toISOString().split("T")[0]; }

interface Boutique { _id: string; nom: string; type: string; }

export default function MouvementsPage() {
  const { data: session } = useSession();
  const role           = (session?.user as any)?.role ?? "";
  const peutSupprimer  = ["admin", "superadmin", "gestionnaire"].includes(role);

  const [mouvements,     setMouvements]     = useState<any[]>([]);
  const [boutiques,      setBoutiques]      = useState<Boutique[]>([]);
  const [page,           setPage]           = useState(1);
  const [total,          setTotal]          = useState(0);
  const [stats,          setStats]          = useState({
    entrees: { count: 0, totalMontant: 0 },
    sorties: { count: 0, totalMontant: 0 },
    balance: 0,
  });
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [filtreBoutique, setFiltreBoutique] = useState("");
  const [filtreType,     setFiltreType]     = useState("");
  const [dateDebut,      setDateDebut]      = useState(defaultDebut);
  const [dateFin,        setDateFin]        = useState(defaultFin);
  const [search,         setSearch]         = useState("");
  const [confirmDel,     setConfirmDel]     = useState<string | null>(null);
  const [deleting,       setDeleting]       = useState(false);
  const [migrating,      setMigrating]      = useState(false);
  const [migrateMsg,     setMigrateMsg]     = useState("");
  const [expanded,       setExpanded]       = useState<Record<string, boolean>>({});
  const LIMIT = 25;

  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data));
  }, []);

  const fetchMouvements = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filtreBoutique) p.set("boutique",  filtreBoutique);
    if (filtreType)     p.set("type",      filtreType);
    if (dateDebut)      p.set("dateDebut", dateDebut);
    if (dateFin)        p.set("dateFin",   dateFin);
    const res  = await fetch(`/api/mouvements-stock?${p}`);
    const json = await res.json();
    if (json.success) {
      setMouvements(json.data);
      setStats(json.stats);
      setTotal(json.pagination?.total ?? 0);
    }
    setLoading(false);
  }, [filtreBoutique, filtreType, dateDebut, dateFin, page]);

  useEffect(() => { fetchMouvements(); }, [fetchMouvements]);
  useEffect(() => { setPage(1); }, [filtreBoutique, filtreType, dateDebut, dateFin]);

  const filtered = mouvements.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.reference?.toLowerCase().includes(q) ||
      m.boutique?.nom?.toLowerCase().includes(q) ||
      m.lignes?.some((l: any) => l.produit?.nom?.toLowerCase().includes(q))
    );
  });

  async function migrer() {
    setMigrating(true); setMigrateMsg("");
    const res  = await fetch("/api/mouvements-stock/migrate", { method: "POST" });
    const json = await res.json();
    setMigrating(false);
    setMigrateMsg(json.message ?? (json.success ? "OK" : "Erreur"));
    if (json.success) fetchMouvements();
  }

  async function supprimer(id: string) {
    setDeleting(true);
    await fetch(`/api/mouvements-stock/${id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDel(null);
    fetchMouvements();
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const boutiqueName = boutiques.find(b => b._id === filtreBoutique)?.nom;

  return (
    <div className="space-y-6">

      {/* ── Bandeau migration ──────────────────────────────────────────── */}
      {["admin","superadmin"].includes(role) && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl px-5 py-3 flex flex-wrap items-center gap-3">
          <span className="text-warning text-sm">⚠</span>
          <p className="text-sm text-warning flex-1">
            Des mouvements créés avec l'ancien schéma peuvent manquer de boutique et de montant.
          </p>
          {migrateMsg && <span className="text-xs font-mono text-success">{migrateMsg}</span>}
          <button onClick={migrer} disabled={migrating}
            className="btn-sm bg-warning/20 hover:bg-warning/30 text-warning font-semibold px-4 py-2
                       rounded-xl transition-colors disabled:opacity-50 text-xs">
            {migrating ? "Migration en cours..." : "🔄 Migrer les anciens mouvements"}
          </button>
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="card p-5 border-l-4 border-success">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Entrées période</p>
            <span className="text-xl">📥</span>
          </div>
          <p className="text-3xl font-extrabold text-success">{fmt(stats.entrees.totalMontant)} F</p>
          <p className="text-xs font-mono text-muted mt-2">{stats.entrees.count} mouvement{stats.entrees.count > 1 ? "s" : ""}</p>
        </div>

        <div className="card p-5 border-l-4 border-danger">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Sorties période</p>
            <span className="text-xl">📤</span>
          </div>
          <p className="text-3xl font-extrabold text-danger">{fmt(stats.sorties.totalMontant)} F</p>
          <p className="text-xs font-mono text-muted mt-2">{stats.sorties.count} mouvement{stats.sorties.count > 1 ? "s" : ""}</p>
        </div>

        <div className={clsx("card p-5 border-l-4", stats.balance >= 0 ? "border-accent" : "border-warning")}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Balance nette</p>
            <span className="text-xl">{stats.balance >= 0 ? "📈" : "📉"}</span>
          </div>
          <p className={clsx("text-3xl font-extrabold", stats.balance >= 0 ? "text-accent" : "text-warning")}>
            {stats.balance >= 0 ? "+" : ""}{fmt(stats.balance)} F
          </p>
          <p className="text-xs font-mono text-muted mt-2">entrées − sorties</p>
        </div>
      </div>

      {/* ── Journal ───────────────────────────────────────────────────── */}
      <div className="card">

        {/* Header */}
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">
              Journal des mouvements
              {boutiqueName && <span className="ml-2 text-accent">· {boutiqueName}</span>}
            </h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              {dateDebut} → {dateFin}
            </p>
          </div>
          <button className="btn-primary btn-sm ml-auto" onClick={() => setShowModal(true)}>
            + Nouveau mouvement
          </button>
        </div>

        {/* Filtres */}
        <div className="px-5 py-4 border-b border-border bg-surface2/30 flex flex-wrap gap-3 items-end">

          <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Recherche</label>
            <input className="input" placeholder="Réf., produit, boutique..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Boutique</label>
            <select className="select w-44" value={filtreBoutique} onChange={e => setFiltreBoutique(e.target.value)}>
              <option value="">Toutes boutiques</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Type</label>
            <select className="select w-36" value={filtreType} onChange={e => setFiltreType(e.target.value)}>
              <option value="">Entrées + Sorties</option>
              <option value="entree">📥 Entrées</option>
              <option value="sortie">📤 Sorties</option>
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

          {(search || filtreBoutique || filtreType || dateDebut !== defaultDebut() || dateFin !== defaultFin()) && (
            <button className="self-end btn-ghost btn-sm text-muted hover:text-danger"
              onClick={() => { setSearch(""); setFiltreBoutique(""); setFiltreType("");
                               setDateDebut(defaultDebut()); setDateFin(defaultFin()); }}>
              ↺ Reset
            </button>
          )}
        </div>

        {/* Table */}
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
              <p className="text-4xl">📭</p>
              <p className="text-muted font-mono text-sm">Aucun mouvement sur cette période</p>
              <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Nouveau mouvement</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Boutique</th>
                  <th>Produits</th>
                  <th className="text-right">Montant total</th>
                  <th>Motif</th>
                  {peutSupprimer && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const lignes: any[] = m.lignes ?? [];
                  const isOpen        = !!expanded[m._id];
                  const showToggle    = lignes.length > 1;

                  return (
                    <tr key={m._id} className={clsx(m.transfertRef && "bg-accent/[0.02]")}>

                      {/* Référence */}
                      <td>
                        <p className="font-mono text-xs text-accent">{m.reference}</p>
                        {m.transfertRef && (
                          <p className="text-[9px] font-mono text-muted mt-0.5">🔀 transfert</p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap">
                        <p className="font-mono text-xs">{fmtDate(m.createdAt)}</p>
                        <p className="font-mono text-[10px] text-muted">{fmtTime(m.createdAt)}</p>
                      </td>

                      {/* Type */}
                      <td>
                        <span className={clsx(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
                          m.type === "entree" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                        )}>
                          {m.type === "entree" ? "📥 Entrée" : "📤 Sortie"}
                        </span>
                      </td>

                      {/* Boutique */}
                      <td>
                        <p className="text-sm font-medium">{m.boutique?.nom}</p>
                        <p className="text-[10px] font-mono text-muted capitalize">{m.boutique?.type}</p>
                      </td>

                      {/* Produits */}
                      <td className="max-w-[200px]">
                        {lignes.length === 0 ? (
                          <span className="text-muted text-xs font-mono">—</span>
                        ) : (
                          <div>
                            {/* Première ligne toujours visible */}
                            <p className="text-sm font-semibold truncate">{lignes[0]?.produit?.nom}</p>
                            <p className="text-[10px] font-mono text-muted">
                              {fmt(lignes[0]?.quantite)} {lignes[0]?.produit?.unite}
                            </p>

                            {/* Lignes suivantes si expand */}
                            {isOpen && lignes.slice(1).map((l: any, i: number) => (
                              <div key={i} className="mt-1.5 border-t border-border/40 pt-1.5">
                                <p className="text-sm font-semibold truncate">{l.produit?.nom}</p>
                                <p className="text-[10px] font-mono text-muted">
                                  {fmt(l.quantite)} {l.produit?.unite}
                                </p>
                              </div>
                            ))}

                            {/* Toggle */}
                            {showToggle && (
                              <button type="button" onClick={() => toggleExpand(m._id)}
                                className="mt-1 text-[10px] font-mono text-accent hover:underline">
                                {isOpen ? `▲ réduire` : `▼ +${lignes.length - 1} autre${lignes.length > 2 ? "s" : ""}`}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Montant total */}
                      <td className="text-right">
                        <span className="font-mono font-bold text-sm">
                          {m.montant > 0 ? `${fmt(m.montant)} F` : "—"}
                        </span>
                        {lignes.length > 1 && (
                          <p className="text-[10px] font-mono text-muted">{lignes.length} lignes</p>
                        )}
                      </td>

                      {/* Motif */}
                      <td className="max-w-[120px]">
                        <p className="text-xs text-muted truncate">{m.motif || "—"}</p>
                      </td>

                      {/* Supprimer */}
                      {peutSupprimer && (
                        <td>
                          {confirmDel === m._id ? (
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              <span className="text-[10px] font-mono text-warning">Annuler ?</span>
                              <button onClick={() => supprimer(m._id)} disabled={deleting}
                                className="btn-danger btn-sm text-xs px-2 disabled:opacity-50">
                                {deleting ? "..." : "Oui"}
                              </button>
                              <button onClick={() => setConfirmDel(null)} className="btn-ghost btn-sm text-xs px-2">Non</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDel(m._id)}
                              className="btn-ghost btn-sm text-danger/60 hover:text-danger text-xs">
                              ✕
                            </button>
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
            <span className="text-xs font-mono text-muted">
              {total} mouvement{total > 1 ? "s" : ""}
              <span className="text-success ml-3">+{fmt(stats.entrees.totalMontant)} F entrées</span>
              <span className="text-danger ml-3">−{fmt(stats.sorties.totalMontant)} F sorties</span>
            </span>
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
