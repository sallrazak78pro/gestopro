// app/(dashboard)/marges/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import clsx from "clsx";

const fmt  = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const pct  = (n: number) => `${n.toFixed(1)}%`;
const fmtDate = (d: string) => {
  const [y, m, j] = d.split("-");
  return `${j}/${m}`;
};

const MODES = [
  { key: "jour",    label: "Aujourd'hui" },
  { key: "semaine", label: "Cette semaine" },
  { key: "mois",    label: "Ce mois" },
  { key: "plage",   label: "Plage personnalisée" },
] as const;

type Mode = typeof MODES[number]["key"];

// Couleur selon le taux de marge
function margeColor(taux: number) {
  if (taux >= 30) return "var(--color-success)";
  if (taux >= 15) return "var(--color-warning)";
  return "var(--color-danger)";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs font-mono shadow-lg"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border2)" }}>
      <p className="font-bold mb-2" style={{ color: "var(--color-fg)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name} : {fmt(p.value)} F
        </p>
      ))}
      {payload.length >= 2 && (
        <p className="mt-1 border-t pt-1" style={{ borderColor: "var(--color-border)", color: "var(--color-accent)" }}>
          Marge : {payload[0]?.value && payload[1]?.value
            ? pct((payload[0].value / (payload[0].value + payload[1].value)) * 100)
            : "—"}
        </p>
      )}
    </div>
  );
};

export default function MargesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "";

  const [mode,    setMode]    = useState<Mode>("jour");
  const [debut,   setDebut]   = useState("");
  const [fin,     setFin]     = useState("");
  const [loading, setLoading] = useState(true);

  const [stats,       setStats]       = useState<any>(null);
  const [evolution,   setEvolution]   = useState<any[]>([]);
  const [topProduits, setTopProduits] = useState<any[]>([]);
  const [parBoutique, setParBoutique] = useState<any[]>([]);

  const fetchMarges = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (mode === "plage" && debut && fin) {
      params.set("debut", debut);
      params.set("fin",   fin);
    }
    const res  = await fetch(`/api/marges?${params}`);
    const json = await res.json();
    if (json.success) {
      setStats(json.stats);
      setEvolution(json.evolution);
      setTopProduits(json.topProduits);
      setParBoutique(json.parBoutique);
    }
    setLoading(false);
  }, [mode, debut, fin]);

  useEffect(() => {
    if (mode !== "plage" || (debut && fin)) fetchMarges();
  }, [fetchMarges, mode, debut, fin]);

  const maxMarge = Math.max(...topProduits.map(p => p.marge), 1);

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-fg)" }}>📊 Analyse des marges</h1>
          {stats && (
            <p className="text-xs font-mono text-muted mt-1">
              {new Date(stats.dateDebut).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              {" — "}
              {new Date(stats.dateFin).toLocaleDateString("fr-FR",   { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Bouton actualiser */}
        <button onClick={fetchMarges} className="btn-ghost btn-sm self-start">🔄 Actualiser</button>
      </div>

      {/* Sélecteur de période */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all",
                mode === m.key
                  ? "bg-accent text-bg border-accent"
                  : "text-muted2 border-border hover:border-border2 hover:text-fg"
              )}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === "plage" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" className="input py-1.5 text-xs font-mono w-36"
              value={debut} onChange={e => setDebut(e.target.value)}
              max={fin || undefined} />
            <span className="text-muted text-xs">→</span>
            <input type="date" className="input py-1.5 text-xs font-mono w-36"
              value={fin} onChange={e => setFin(e.target.value)}
              min={debut || undefined} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="card flex items-center justify-center h-48 gap-3 text-muted font-mono text-sm">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Calcul des marges…
        </div>
      ) : !stats ? (
        <div className="card flex items-center justify-center h-48 text-muted font-mono text-sm">
          Sélectionnez une plage de dates
        </div>
      ) : (
        <>
          {/* ── KPIs ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            <div className="card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Chiffre d'affaires</p>
              <p className="text-2xl font-extrabold" style={{ color: "var(--color-fg)" }}>
                {fmt(stats.totalCA)} <span className="text-sm font-mono text-muted">F</span>
              </p>
              <p className="text-xs text-muted mt-1">{stats.nbVentes} vente{stats.nbVentes > 1 ? "s" : ""}</p>
            </div>

            <div className="card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-warning" />
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Coût d'achat</p>
              <p className="text-2xl font-extrabold text-warning">
                {fmt(stats.totalCout)} <span className="text-sm font-mono text-muted">F</span>
              </p>
              <p className="text-xs text-muted mt-1">
                {stats.totalCA > 0 ? pct((stats.totalCout / stats.totalCA) * 100) : "0%"} du CA
              </p>
            </div>

            <div className="card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: margeColor(stats.tauxMarge) }} />
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Marge brute</p>
              <p className="text-2xl font-extrabold"
                style={{ color: margeColor(stats.tauxMarge) }}>
                {fmt(stats.totalMarge)} <span className="text-sm font-mono text-muted">F</span>
              </p>
              <p className="text-xs text-muted mt-1">
                {stats.totalMarge >= 0 ? "+" : ""}{fmt(stats.totalMarge)} F net
              </p>
            </div>

            <div className="card p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: margeColor(stats.tauxMarge) }} />
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Taux de marge</p>
              <p className="text-2xl font-extrabold"
                style={{ color: margeColor(stats.tauxMarge) }}>
                {pct(stats.tauxMarge)}
              </p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-surface2">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(stats.tauxMarge, 100)}%`,
                    background: margeColor(stats.tauxMarge),
                  }} />
              </div>
            </div>
          </div>

          {/* ── Graphique évolution ───────────────────────────────────────── */}
          {evolution.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-bold mb-4" style={{ color: "var(--color-fg)" }}>
                Évolution CA / Coût / Marge
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={evolution} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradCA"    x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMarge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tickFormatter={fmtDate}
                    tick={{ fontSize: 10, fill: "var(--color-muted)", fontFamily: "monospace" }}
                    axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${fmt(v)}`}
                    tick={{ fontSize: 10, fill: "var(--color-muted)", fontFamily: "monospace" }}
                    axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />
                  <Area type="monotone" dataKey="ca"    name="CA"
                    stroke="#00d4ff" strokeWidth={2} fill="url(#gradCA)" />
                  <Area type="monotone" dataKey="marge" name="Marge"
                    stroke="#10b981" strokeWidth={2} fill="url(#gradMarge)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Top produits par marge ──────────────────────────────────── */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-bold" style={{ color: "var(--color-fg)" }}>🏆 Top produits par marge</h2>
                <span className="text-xs font-mono text-muted">{topProduits.length} produits</span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                {topProduits.length === 0 ? (
                  <p className="text-center py-8 text-muted font-mono text-sm">Aucune donnée</p>
                ) : topProduits.map((p, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-muted shrink-0">#{i + 1}</span>
                        <span className="text-sm font-semibold truncate" style={{ color: "var(--color-fg)" }}>
                          {p.nom}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-sm font-mono font-bold"
                          style={{ color: margeColor(p.tauxMarge) }}>
                          {fmt(p.marge)} F
                        </span>
                        <span className="text-[10px] font-mono text-muted ml-1">
                          ({pct(p.tauxMarge)})
                        </span>
                      </div>
                    </div>
                    {/* Barre de marge */}
                    <div className="h-1 rounded-full overflow-hidden bg-surface2">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${(p.marge / maxMarge) * 100}%`,
                          background: margeColor(p.tauxMarge),
                        }} />
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] font-mono text-muted">
                      <span>Qté : {p.qte.toFixed(2)}</span>
                      <span>CA : {fmt(p.ca)} F</span>
                      <span>Coût : {fmt(p.cout)} F</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Marge par boutique ──────────────────────────────────────── */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-sm font-bold" style={{ color: "var(--color-fg)" }}>🏪 Marge par boutique</h2>
              </div>

              {parBoutique.length === 0 ? (
                <p className="text-center py-8 text-muted font-mono text-sm">Aucune donnée</p>
              ) : (
                <>
                  <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                    {parBoutique.map((b, i) => (
                      <div key={i} className="px-5 py-3.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>{b.nom}</span>
                          <span className="text-sm font-mono font-bold"
                            style={{ color: margeColor(b.tauxMarge) }}>
                            {pct(b.tauxMarge)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                          <div className="bg-surface2 rounded-lg px-2.5 py-2 text-center">
                            <p className="text-muted mb-0.5">CA</p>
                            <p className="font-bold" style={{ color: "var(--color-fg)" }}>{fmt(b.ca)} F</p>
                          </div>
                          <div className="bg-surface2 rounded-lg px-2.5 py-2 text-center">
                            <p className="text-muted mb-0.5">Coût</p>
                            <p className="font-bold text-warning">{fmt(b.cout)} F</p>
                          </div>
                          <div className="bg-surface2 rounded-lg px-2.5 py-2 text-center">
                            <p className="text-muted mb-0.5">Marge</p>
                            <p className="font-bold" style={{ color: margeColor(b.tauxMarge) }}>{fmt(b.marge)} F</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Graphique barres boutiques */}
                  {parBoutique.length > 1 && (
                    <div className="px-5 pb-5 pt-2">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={parBoutique} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="nom"
                            tick={{ fontSize: 10, fill: "var(--color-muted)", fontFamily: "monospace" }}
                            axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip formatter={(v: number) => `${fmt(v)} F`}
                            contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border2)", borderRadius: 12, fontSize: 11, fontFamily: "monospace" }} />
                          <Bar dataKey="ca"    name="CA"    fill="#00d4ff" radius={[4,4,0,0]} opacity={0.7} />
                          <Bar dataKey="marge" name="Marge" fill="#10b981" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Indicateur de santé ──────────────────────────────────────── */}
          {stats.totalCA > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-bold mb-4" style={{ color: "var(--color-fg)" }}>💡 Analyse de la rentabilité</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: "Rentabilité",
                    value: stats.tauxMarge >= 30 ? "Excellente" : stats.tauxMarge >= 20 ? "Bonne" : stats.tauxMarge >= 10 ? "Correcte" : "Faible",
                    color: margeColor(stats.tauxMarge),
                    icon:  stats.tauxMarge >= 30 ? "🟢" : stats.tauxMarge >= 20 ? "🟡" : stats.tauxMarge >= 10 ? "🟠" : "🔴",
                    desc:  stats.tauxMarge >= 30 ? "Taux de marge > 30% — très bon niveau" : stats.tauxMarge >= 20 ? "Taux de marge entre 20% et 30%" : stats.tauxMarge >= 10 ? "Taux de marge entre 10% et 20%" : "Taux de marge < 10% — revoir les prix",
                  },
                  {
                    label: "Produit le + rentable",
                    value: topProduits[0]?.nom ?? "—",
                    color: "var(--color-accent)",
                    icon:  "⭐",
                    desc:  topProduits[0] ? `Marge de ${pct(topProduits[0].tauxMarge)} — ${fmt(topProduits[0].marge)} F générés` : "Aucune donnée",
                  },
                  {
                    label: "Produit le - rentable",
                    value: topProduits.at(-1)?.nom ?? "—",
                    color: topProduits.at(-1)?.tauxMarge < 10 ? "var(--color-danger)" : "var(--color-muted2)",
                    icon:  "⚠️",
                    desc:  topProduits.at(-1) ? `Marge de ${pct(topProduits.at(-1).tauxMarge)} — ${fmt(topProduits.at(-1).marge)} F générés` : "Aucune donnée",
                  },
                ].map((item, i) => (
                  <div key={i} className="bg-surface2 rounded-2xl px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-[10px] font-mono text-muted uppercase tracking-widest">{item.label}</span>
                    </div>
                    <p className="text-sm font-bold truncate" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
