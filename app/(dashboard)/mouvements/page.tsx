// app/(dashboard)/mouvements/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { KpiCard } from "@/components/ui/KpiCard";
import NouveauMouvementModal from "@/components/mouvements/NouveauMouvementModal";
import Pagination from "@/components/ui/Pagination";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; badge: string }> = {
  depot_vers_boutique:   { label: "Dépôt → Boutique",     icon: "🏭→🏪", color: "text-accent",   badge: "badge-blue" },
  boutique_vers_boutique:{ label: "Boutique → Boutique",   icon: "🏪→🏪", color: "text-purple-400",badge: "badge-purple" },
  entree_fournisseur:    { label: "Entrée fournisseur",    icon: "📦→🏭", color: "text-success",  badge: "badge-green" },
  sortie_perte:          { label: "Sortie / Perte",        icon: "🗑️",    color: "text-danger",   badge: "badge-red" },
};

const STATUT_CONFIG: Record<string, { label: string; badge: string }> = {
  en_cours: { label: "En cours",  badge: "badge-orange" },
  livre:    { label: "Livré",     badge: "badge-green" },
  annule:   { label: "Annulé",    badge: "badge-red" },
};

function defaultDebut() {
  const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
}
function defaultFin() {
  return new Date().toISOString().split("T")[0];
}

export default function MouvementsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "";
  const peutAnnuler = ["admin", "superadmin", "gestionnaire"].includes(role);

  const [mouvements, setMouvements] = useState<any[]>([]);
  const [boutiques, setBoutiques]   = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;
  const [stats, setStats] = useState({ nbAujourdhui: 0, nbEnTransit: 0, nbEntrees: 0, totalUnites: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtreType,        setFiltreType]        = useState("");
  const [filtreStatut,      setFiltreStatut]      = useState("");
  const [filtreDestination, setFiltreDestination] = useState("");
  const [dateDebut,         setDateDebut]         = useState(defaultDebut);
  const [dateFin,           setDateFin]           = useState(defaultFin);
  const [search, setSearch] = useState("");
  const [annulLoading, setAnnulLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => { if (j.success) setBoutiques(j.data); });
  }, []);

  const fetchMouvements = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filtreType)        params.set("type",        filtreType);
    if (filtreStatut)      params.set("statut",      filtreStatut);
    if (filtreDestination) params.set("destination", filtreDestination);
    if (dateDebut)         params.set("dateDebut",   dateDebut);
    if (dateFin)           params.set("dateFin",     dateFin);
    const res  = await fetch(`/api/mouvements-stock?${params}`);
    const json = await res.json();
    if (json.success) { setMouvements(json.data); setStats(json.stats); setTotal(json.pagination?.total ?? 0); }
    setLoading(false);
  }, [filtreType, filtreStatut, filtreDestination, dateDebut, dateFin, page]);

  useEffect(() => { fetchMouvements(); }, [fetchMouvements]);
  useEffect(() => { setPage(1); }, [filtreType, filtreStatut, filtreDestination, dateDebut, dateFin]);

  const filtered = mouvements.filter(m =>
    m.reference?.toLowerCase().includes(search.toLowerCase()) ||
    m.produit?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    m.source?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    m.destination?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  const totalMontant = filtered.reduce((s, m) => s + (m.quantite * (m.produit?.prixAchat ?? 0)), 0);

  async function annuler(id: string) {
    if (!confirm("Annuler ce mouvement ? Le stock sera remis en place.")) return;
    setAnnulLoading(id);
    await fetch(`/api/mouvements-stock/${id}`, { method: "PUT" });
    await fetchMouvements();
    setAnnulLoading(null);
  }

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Mouvements aujourd'hui" value={String(stats.nbAujourdhui)} change="Opérations du jour" trend="up" icon="🔄" />
        <KpiCard label="En cours / transit" value={String(stats.nbEnTransit)} change="En attente de livraison" trend={stats.nbEnTransit > 0 ? "neutral" : "up"} icon="🚚" />
        <KpiCard label="Entrées fournisseurs" value={String(stats.nbEntrees)} change="Total historique" trend="up" icon="📥" />
        <KpiCard label="Unités déplacées" value={fmt(stats.totalUnites)} change="Total historique" trend="up" icon="📦" />
      </div>

      {/* Schéma visuel des flux */}
      <FluxDiagram />

      {/* Table */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Journal des mouvements</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Tous les déplacements de marchandise
            </p>
          </div>
          <button className="btn-primary btn-sm ml-auto" onClick={() => setShowModal(true)}>
            + Nouveau mouvement
          </button>
        </div>

        {/* ── Filtres ─────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-border bg-surface2/30 flex flex-wrap gap-3 items-end">
          {/* Recherche */}
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Recherche</label>
            <input className="input" placeholder="Réf., produit, lieu..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Type */}
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

          {/* Destination */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Destination</label>
            <select className="select w-44" value={filtreDestination} onChange={e => setFiltreDestination(e.target.value)}>
              <option value="">Toutes destinations</option>
              {boutiques.map(b => (
                <option key={b._id} value={b._id}>{b.nom}</option>
              ))}
            </select>
          </div>

          {/* Statut */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Statut</label>
            <select className="select w-36" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="en_cours">En cours</option>
              <option value="livre">Livré</option>
              <option value="annule">Annulé</option>
            </select>
          </div>

          {/* Période */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Du</label>
            <input type="date" className="input w-38"
              value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Au</label>
            <input type="date" className="input w-38"
              value={dateFin} onChange={e => setDateFin(e.target.value)} />
          </div>

          {/* Reset */}
          <button
            className="btn-ghost btn-sm self-end"
            onClick={() => {
              setFiltreType(""); setFiltreStatut(""); setFiltreDestination("");
              setDateDebut(defaultDebut()); setDateFin(defaultFin()); setSearch("");
            }}
            title="Réinitialiser les filtres"
          >↺ Reset</button>
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
              <p className="text-4xl">🔄</p>
              <p className="text-muted font-mono text-sm">Aucun mouvement enregistré</p>
              <button className="btn-primary btn-sm mt-2" onClick={() => setShowModal(true)}>
                Créer le premier mouvement
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
                  <th>Qté</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const tc = TYPE_CONFIG[m.type];
                  const sc = STATUT_CONFIG[m.statut];
                  return (
                    <tr key={m._id} className={m.statut === "annule" ? "opacity-50" : ""}>
                      <td className="font-mono text-xs text-accent">{m.reference}</td>
                      <td className="font-mono text-xs text-muted">
                        {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                        <span className="block text-[10px]">
                          {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className={tc?.badge ?? "badge-blue"}>{tc?.label}</span>
                        </div>
                      </td>
                      <td>
                        <p className="font-semibold text-sm">{m.produit?.nom}</p>
                        <p className="text-[10px] font-mono text-muted">{m.produit?.reference}</p>
                      </td>
                      <td>
                        {m.source ? (
                          <div>
                            <p className="text-sm font-medium">{m.source.nom}</p>
                            <p className="text-[10px] font-mono text-muted capitalize">{m.source.type}</p>
                          </div>
                        ) : <span className="text-muted text-xs font-mono">Ext. fournisseur</span>}
                      </td>
                      <td>
                        {m.destination ? (
                          <div>
                            <p className="text-sm font-medium">{m.destination.nom}</p>
                            <p className="text-[10px] font-mono text-muted capitalize">{m.destination.type}</p>
                          </div>
                        ) : <span className="text-muted text-xs font-mono">—</span>}
                      </td>
                      <td>
                        <span className="font-mono font-bold text-lg text-accent">{m.quantite}</span>
                        <span className="text-[10px] text-muted block font-mono">{m.produit?.unite}</span>
                      </td>
                      <td>
                        {m.produit?.prixAchat
                          ? <span className="font-mono font-semibold text-sm">{fmt(m.quantite * m.produit.prixAchat)} F</span>
                          : <span className="text-muted font-mono text-xs">—</span>}
                      </td>
                      <td><span className={sc?.badge}>{sc?.label}</span></td>
                      <td>
                        {m.statut !== "annule" && peutAnnuler && (
                          <button
                            onClick={() => annuler(m._id)}
                            disabled={annulLoading === m._id}
                            className="btn-danger btn-sm disabled:opacity-50"
                          >
                            {annulLoading === m._id ? "..." : "✕ Annuler"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-6">
              <p className="text-xs font-mono text-muted">
                {filtered.length} mouvement{filtered.length > 1 ? "s" : ""} affichés
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Montant total :</span>
                <span className="font-mono font-bold text-accent">{fmt(totalMontant)} F</span>
              </div>
            </div>
            <button onClick={fetchMouvements} className="btn-ghost btn-sm">🔄 Actualiser</button>
          </div>
        )}
      </div>

      {showModal && (
        <NouveauMouvementModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchMouvements(); }}
        />
      )}
      <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
    </div>
  );
}

// ── Schéma visuel des flux ────────────────────────────────────
function FluxDiagram() {
  return (
    <div className="card p-5">
      <h3 className="card-title mb-1">Schéma des flux de marchandise</h3>
      <p className="text-[11px] font-mono text-muted mb-5 uppercase tracking-widest">
        Vue des mouvements possibles
      </p>
      <div className="flex items-center justify-center gap-4 flex-wrap">

        {/* Fournisseur */}
        <FluxNode icon="🏭" label="Fournisseur" color="border-muted text-muted" />

        <FluxArrow label="Entrée fournisseur" color="text-success" />

        {/* Dépôt */}
        <FluxNode icon="📦" label="Dépôt Central" color="border-accent text-accent" main />

        <div className="flex flex-col gap-4">
          <FluxArrow label="Approvision." color="text-accent" />
          <FluxArrow label="Transfert" color="text-purple-400" />
        </div>

        {/* Boutiques */}
        <div className="flex flex-col gap-3">
          {["PDV Plateau", "PDV Cocody", "PDV Yopougon"].map((pdv, i) => (
            // eslint-disable-next-line react/jsx-key
            <FluxNode key={i} icon="🏪" label={pdv} color="border-success/50 text-success" />
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <FluxArrow label="Ventes" color="text-warning" vertical />
          <div className="flex items-center gap-2 mt-2">
            <FluxArrow label="Perte / Casse" color="text-danger" />
          </div>
        </div>

        {/* Clients / Sortie */}
        <div className="flex flex-col gap-3">
          <FluxNode icon="👤" label="Clients" color="border-warning/50 text-warning" />
          <FluxNode icon="🗑️" label="Sortie" color="border-danger/50 text-danger" />
        </div>
      </div>
    </div>
  );
}

function FluxNode({ icon, label, color, main }: { icon: string; label: string; color: string; main?: boolean; key?: any }) {
  return (
    <div className={clsx(
      "flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 min-w-[90px] text-center",
      main ? "border-accent bg-accent/10" : "border-border bg-surface2",
      color
    )}>
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-mono font-semibold leading-tight">{label}</span>
    </div>
  );
}

function FluxArrow({ label, color, vertical }: { label: string; color: string; vertical?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-1", vertical ? "flex-col" : "flex-row")}>
      <div className={clsx("text-[10px] font-mono font-medium whitespace-nowrap", color)}>{label}</div>
      <span className={clsx("font-bold text-lg", color)}>→</span>
    </div>
  );
}
