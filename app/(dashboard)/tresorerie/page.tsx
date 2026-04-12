// app/(dashboard)/tresorerie/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import MouvementArgentModal from "@/components/tresorerie/MouvementArgentModal";
import ExportButton from "@/components/ui/ExportButton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const TYPE_CONFIG: Record<string, { label: string; icon: string; badge: string; flux: "entree" | "sortie" | "neutre" }> = {
  versement_boutique: { label: "Versement boutique",   icon: "💸", badge: "badge-green",  flux: "sortie" },
  versement_banque:   { label: "Versement banque",      icon: "🏦", badge: "badge-blue",   flux: "sortie" },
  avance_caisse:      { label: "Avance de caisse",      icon: "🔄", badge: "badge-orange", flux: "entree" },
  remboursement:      { label: "Remboursement",         icon: "↩️", badge: "badge-blue",   flux: "sortie" },
  depense:            { label: "Dépense",               icon: "💳", badge: "badge-red",    flux: "sortie" },
  achat_direct:       { label: "Achat direct",          icon: "🛍️", badge: "badge-orange", flux: "sortie" },
  depot_tiers:        { label: "Dépôt tiers",           icon: "👤", badge: "badge-purple", flux: "entree" },
  retrait_tiers:      { label: "Retrait tiers",         icon: "👤", badge: "badge-orange", flux: "sortie" },
};

const CAT_LABEL: Record<string, string> = {
  salaire: "💼 Salaire", loyer: "🏠 Loyer", divers: "📌 Divers",
};

export default function TresoreriePage() {
  const [mouvements, setMouvements]   = useState<any[]>([]);
  const [stats, setStats]             = useState({ totalEntrees: 0, totalSorties: 0, soldeNet: 0, totalDepenses: 0, versementsRecus: 0, versementsBanque: 0 });
  const [rapport, setRapport]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [defaultType, setDefaultType] = useState("");
  const [filtreType, setFiltreType]   = useState("");
  const [filtreBoutique, setFiltreBoutique] = useState("");
  const [boutiques, setBoutiques]     = useState<any[]>([]);
  const [search, setSearch]           = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtreType)    params.set("type",     filtreType);
    if (filtreBoutique) params.set("boutique", filtreBoutique);
    const [res, rapRes] = await Promise.all([
      fetch(`/api/tresorerie?${params}`),
      fetch("/api/tresorerie/rapport"),
    ]);
    const [json, rapJson] = await Promise.all([res.json(), rapRes.json()]);
    if (json.success)   { setMouvements(json.data); setStats(json.stats); }
    if (rapJson.success) setRapport(rapJson.data);
    setLoading(false);
  }, [filtreType, filtreBoutique]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data.filter((b: any) => b.type === "boutique")));
  }, []);

  function openModal(type = "") { setDefaultType(type); setShowModal(true); }

  const filtered = mouvements.filter(m =>
    m.reference?.toLowerCase().includes(search.toLowerCase()) ||
    m.motif?.toLowerCase().includes(search.toLowerCase()) ||
    m.boutique?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    m.tiersNom?.toLowerCase().includes(search.toLowerCase())
  );

  // Données pour le graphique (7 derniers jours)
  const chartData = buildChartData(mouvements);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total entrées" value={fmt(stats.totalEntrees) + " F"} change="Dépôts tiers + avances reçues" trend="up" icon="📥" />
        <KpiCard label="Total sorties" value={fmt(stats.totalSorties) + " F"} change="Versements + dépenses + retraits" trend="down" icon="📤" />
        <KpiCard label="Solde net" value={fmt(stats.soldeNet) + " F"} change="Entrées − Sorties" trend={stats.soldeNet >= 0 ? "up" : "down"} icon="⚖️" />
        <KpiCard label="Versé en banque" value={fmt(stats.versementsBanque) + " F"} change="Dépôts bancaires cumulés" trend="up" icon="🏦" />
      </div>

      {/* ── Soldes par boutique en temps réel ──────────────── */}
      {rapport?.soldesParBoutique?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">💰 Soldes en temps réel</h2>
            <span className="text-[11px] font-mono text-muted">Caisse disponible par boutique</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {rapport.soldesParBoutique.map((b: any) => (
              <div key={b._id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{b.nom}</span>
                    {b.estPrincipale && <span className="badge-blue text-[10px]">★ Principale</span>}
                    {b.sessionActive
                      ? <span className="badge-green text-[10px]">🟢 Ouverte</span>
                      : <span className="badge-orange text-[10px]">🔴 Fermée</span>}
                  </div>
                  {b.dernierVersement && (
                    <p className="text-[11px] font-mono text-muted mt-0.5">
                      Dernier versement : {fmt(b.dernierVersement.montant)} F
                      · {new Date(b.dernierVersement.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </p>
                  )}
                  {!b.dernierVersement && !b.estPrincipale && (
                    <p className="text-[11px] font-mono text-warning mt-0.5">⚠ Aucun versement enregistré</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-extrabold text-lg text-success">{fmt(b.solde)} F</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Comparaisons semaine / mois ─────────────────────── */}
      {rapport?.comparaison && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[
            { label: "Cette semaine vs semaine précédente", data: rapport.comparaison.semaine },
            { label: "Ce mois vs mois précédent",          data: rapport.comparaison.mois },
          ].map((bloc, bi) => (
            <div key={bi} className="card p-5">
              <h3 className="card-title mb-4">{bloc.label}</h3>
              <div className="space-y-3">
                {[
                  { key: "caVentes",   label: "CA ventes",       icon: "🧾", color: "text-accent"  },
                  { key: "versements", label: "Versements reçus", icon: "💸", color: "text-success" },
                  { key: "depenses",   label: "Dépenses",         icon: "💳", color: "text-danger"  },
                  { key: "soldeFinal", label: "Solde final",      icon: "💰", color: "text-warning" },
                ].map(row => {
                  const cur  = bloc.data.courant[row.key] ?? 0;
                  const prev = bloc.data.precedent[row.key] ?? 0;
                  const evo  = bloc.data.evolutions[row.key] ?? 0;
                  return (
                    <div key={row.key} className="flex items-center gap-3">
                      <span className="text-base w-6 shrink-0">{row.icon}</span>
                      <span className="text-sm flex-1" style={{ color: "var(--color-fg2)" }}>{row.label}</span>
                      <div className="text-right">
                        <p className={`font-mono font-bold text-sm ${row.color}`}>{fmt(cur)} F</p>
                        <p className="text-[10px] font-mono" style={{ color: evo >= 0 ? "#10b981" : "#ef4444" }}>
                          {evo >= 0 ? "▲" : "▼"} {Math.abs(evo)}% (préc. {fmt(prev)} F)
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Historique versements boutique→principale (mois) ── */}
      {rapport?.versementsMois && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🔄 Versements boutiques → principale</h2>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-muted">{rapport.versementsMois.periode}</span>
              <span className="badge-green font-mono">{fmt(rapport.versementsMois.total)} F</span>
            </div>
          </div>
          {rapport.versementsMois.liste.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">💸</p>
              <p className="text-muted font-mono text-sm">Aucun versement ce mois</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {rapport.versementsMois.liste.map((v: any) => (
                <div key={v._id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
                      {v.boutique?.nom} → {v.boutiqueDestination?.nom}
                    </p>
                    <p className="text-xs font-mono text-muted">
                      {new Date(v.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {v.motif && ` · ${v.motif}`}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-success shrink-0">
                    {fmt(v.montant)} F
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <button key={type} onClick={() => openModal(type)}
            className={clsx(
              "flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2",
              "transition-all hover:-translate-y-0.5 hover:shadow-card text-center",
              cfg.flux === "entree"
                ? "border-success/30 bg-success/5 hover:border-success/60"
                : cfg.flux === "sortie"
                ? "border-danger/30 bg-danger/5 hover:border-danger/60"
                : "border-accent/30 bg-accent/5 hover:border-accent/60"
            )}>
            <span className="text-2xl">{cfg.icon}</span>
            <span className="text-[11px] font-mono font-semibold leading-tight text-muted2">{cfg.label}</span>
            <span className={clsx("text-[9px] font-mono uppercase tracking-wider font-bold",
              cfg.flux === "entree" ? "text-success" : cfg.flux === "sortie" ? "text-danger" : "text-accent"
            )}>
              {cfg.flux === "entree" ? "▲ Entrée" : cfg.flux === "sortie" ? "▼ Sortie" : "⇄ Neutre"}
            </span>
          </button>
        ))}
      </div>

      {/* Graphique */}
      <div className="card p-5">
        <h3 className="card-title mb-1">Flux de trésorerie — 7 derniers jours</h3>
        <p className="text-[11px] font-mono text-muted mb-5 uppercase tracking-widest">Entrées et sorties d'argent · FCFA</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="jour" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="entrees" name="Entrées" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sorties" name="Sorties" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Journal */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Journal de trésorerie</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Tous les mouvements d'argent
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input w-44" placeholder="🔍  Réf., motif, boutique..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="select w-44" value={filtreType} onChange={e => setFiltreType(e.target.value)}>
              <option value="">Tous les types</option>
              {Object.entries(TYPE_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.icon} {c.label}</option>
              ))}
            </select>
            <select className="select w-40" value={filtreBoutique} onChange={e => setFiltreBoutique(e.target.value)}>
              <option value="">Toutes boutiques</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
            <ExportButton type="tresorerie" />
            <button className="btn-primary btn-sm" onClick={() => openModal()}>+ Opération</button>
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
              <p className="text-4xl">💳</p>
              <p className="text-muted font-mono text-sm">Aucune opération enregistrée</p>
              <button className="btn-primary btn-sm mt-2" onClick={() => openModal()}>Créer la première opération</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Boutique</th>
                  <th>Détail</th>
                  <th>Flux</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const tc = TYPE_CONFIG[m.type];
                  return (
                    <tr key={m._id}>
                      <td className="font-mono text-xs text-accent">{m.reference}</td>
                      <td className="font-mono text-xs text-muted">
                        {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                        <span className="block text-[10px]">
                          {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td><span className={tc?.badge}>{tc?.icon} {tc?.label}</span></td>
                      <td>
                        <p className="text-sm font-medium">{m.boutique?.nom}</p>
                        {m.boutiqueDestination && (
                          <p className="text-[10px] font-mono text-muted">→ {m.boutiqueDestination.nom}</p>
                        )}
                      </td>
                      <td className="max-w-[200px]">
                        {m.categorieDepense && (
                          <span className="badge-purple text-[10px] mb-1 block w-fit">
                            {CAT_LABEL[m.categorieDepense]}
                          </span>
                        )}
                        {m.tiersNom && <p className="text-sm font-semibold">{m.tiersNom}</p>}
                        {m.motif && <p className="text-xs text-muted truncate">{m.motif}</p>}
                        {m.avanceRef && <p className="text-[10px] font-mono text-muted">Réf: {m.avanceRef}</p>}
                      </td>
                      <td>
                        {tc?.flux === "entree"
                          ? <span className="text-success font-mono font-bold text-xs">▲ Entrée</span>
                          : <span className="text-danger font-mono font-bold text-xs">▼ Sortie</span>}
                      </td>
                      <td>
                        <span className={clsx("font-mono font-extrabold",
                          tc?.flux === "entree" ? "text-success" : "text-danger"
                        )}>
                          {tc?.flux === "entree" ? "+" : "−"}{fmt(m.montant)} F
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs font-mono text-muted">{filtered.length} opération{filtered.length > 1 ? "s" : ""}</p>
            <button onClick={fetchData} className="btn-ghost btn-sm">🔄 Actualiser</button>
          </div>
        )}
      </div>

      {showModal && (
        <MouvementArgentModal
          defaultType={defaultType}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────
function buildChartData(mouvements: any[]) {
  const days: Record<string, { entrees: number; sorties: number }> = {};
  const ENTREE_TYPES = ["avance_caisse", "depot_tiers"];
  const SORTIE_TYPES = ["versement_boutique", "versement_banque", "depense", "achat_direct", "remboursement", "retrait_tiers"];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("fr-FR", { weekday: "short" });
    days[key] = { entrees: 0, sorties: 0 };
  }

  mouvements.forEach(m => {
    const d = new Date(m.createdAt);
    const key = d.toLocaleDateString("fr-FR", { weekday: "short" });
    if (!days[key]) return;
    if (ENTREE_TYPES.includes(m.type)) days[key].entrees += m.montant;
    if (SORTIE_TYPES.includes(m.type)) days[key].sorties += m.montant;
  });

  return Object.entries(days).map(([jour, v]) => ({ jour, ...v }));
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border2 rounded-xl px-4 py-3 font-mono text-xs shadow-card">
      <p className="text-muted mb-2 capitalize">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name} : {fmt(p.value)} F</p>
      ))}
    </div>
  );
}
