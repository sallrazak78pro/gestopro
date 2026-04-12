// app/(dashboard)/dashboard/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import clsx from "clsx";

const fmt  = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtM = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
  : n >= 1_000   ? (n / 1_000).toFixed(0) + "k"
  : String(Math.round(n));

const toISO = (d: Date) => d.toISOString().split("T")[0];

// Raccourcis prédéfinis
const today = new Date();
const PRESETS = [
  { label: "Aujourd'hui",    debut: toISO(today), fin: toISO(today) },
  { label: "7 derniers jours", debut: toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), fin: toISO(today) },
  { label: "Ce mois",        debut: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), fin: toISO(today) },
  { label: "Mois précédent", debut: toISO(new Date(today.getFullYear(), today.getMonth() - 1, 1)), fin: toISO(new Date(today.getFullYear(), today.getMonth(), 0)) },
  { label: "Cette année",    debut: toISO(new Date(today.getFullYear(), 0, 1)), fin: toISO(today) },
];

const STATUT_BADGE: Record<string, string> = { payee: "badge-green", en_attente: "badge-orange", annulee: "badge-red" };
const STATUT_LABEL: Record<string, string> = { payee: "Payée", en_attente: "En attente", annulee: "Annulée" };

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border2 rounded-xl px-4 py-3 font-mono text-xs shadow-card">
      <p className="text-muted mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name} : {fmt(p.value)} F</p>
      ))}
    </div>
  );
}

function EvoTag({ val }: { val: string | null }) {
  if (!val) return null;
  const n = parseFloat(val);
  return (
    <span className={clsx("text-[11px] font-mono font-bold", n >= 0 ? "text-success" : "text-danger")}>
      {n >= 0 ? "▲" : "▼"} {Math.abs(n)}%
    </span>
  );
}

export default function DashboardPage() {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg,  setErrMsg]  = useState("");
  const [debut,   setDebut]   = useState(PRESETS[2].debut); // Ce mois
  const [fin,     setFin]     = useState(PRESETS[2].fin);
  const [preset,  setPreset]  = useState(2);

  const fetchData = useCallback(async () => {
    setLoading(true); setErrMsg("");
    const params = new URLSearchParams({ debut, fin });
    fetch(`/api/dashboard?${params}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); else setErrMsg(j.message); })
      .catch(() => setErrMsg("Impossible de charger le tableau de bord"))
      .finally(() => setLoading(false));
  }, [debut, fin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyPreset(i: number) {
    setPreset(i);
    setDebut(PRESETS[i].debut);
    setFin(PRESETS[i].fin);
  }

  function applyCustom(d: string, f: string) {
    setPreset(-1);
    setDebut(d); setFin(f);
  }

  return (
    <div className="space-y-5">

      {/* ── Filtre intervalle de dates ─────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Raccourcis */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => applyPreset(i)}
                className={clsx("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  preset === i
                    ? "bg-accent text-bg"
                    : "bg-surface2 text-muted2 hover:bg-surface3 hover:text-fg")}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Séparateur */}
          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
          {/* Saisie manuelle */}
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={debut}
              max={fin}
              onChange={e => applyCustom(e.target.value, fin)}
              className="input py-1.5 text-xs font-mono w-36" />
            <span className="text-muted text-xs font-mono">→</span>
            <input type="date" value={fin}
              min={debut} max={toISO(today)}
              onChange={e => applyCustom(debut, e.target.value)}
              className="input py-1.5 text-xs font-mono w-36" />
            <button onClick={fetchData}
              className="btn-primary btn-sm">
              🔍 Appliquer
            </button>
          </div>
          {data?.periode && (
            <p className="text-[11px] font-mono text-muted ml-auto hidden xl:block">
              {data.periode.nbJours} jour{data.periode.nbJours > 1 ? "s" : ""} analysé{data.periode.nbJours > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* ── Loading / Erreur ──────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-48 gap-3 text-muted">
          <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="font-mono text-sm">Chargement...</p>
        </div>
      )}
      {errMsg && (
        <div className="card p-8 text-center space-y-3">
          <p className="text-3xl">⚠️</p>
          <p className="text-danger font-mono text-sm">{errMsg}</p>
          <button onClick={fetchData} className="btn-ghost btn-sm">🔄 Réessayer</button>
        </div>
      )}

      {!loading && data && (() => {
        const { kpis, graphData, repartitionPDV, dernieresVentes, alertesStock, sessionsOuvertes, vueFinanciere } = data;

        return (
          <>
            {/* Bandeau sessions ouvertes */}
            {sessionsOuvertes?.length > 0 && (
              <div className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-2xl px-5 py-3">
                <span className="text-xl">🟢</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-success">
                    {sessionsOuvertes.length} caisse{sessionsOuvertes.length > 1 ? "s" : ""} ouverte{sessionsOuvertes.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs font-mono text-muted truncate">
                    {sessionsOuvertes.map((s: any) => s.boutique?.nom).join(" · ")}
                  </p>
                </div>
                <Link href="/caisse" className="btn-ghost btn-sm shrink-0">Voir →</Link>
              </div>
            )}

            {/* ── KPIs principaux ─────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { icon: "🧾", label: "CA de la période",   value: fmt(kpis.caPeriode) + " F",  sub: `${kpis.caNb} vente${kpis.caNb > 1 ? "s" : ""}`, evo: kpis.caEvolution, color: "text-accent" },
                { icon: "💳", label: "Dépenses",           value: fmt(kpis.depenses)  + " F",  sub: "Sur la période",    evo: kpis.depEvolution,    color: "text-danger"  },
                { icon: "💸", label: "Versements reçus",   value: fmt(kpis.versements) + " F", sub: `${kpis.versementsNb} versement${kpis.versementsNb > 1 ? "s" : ""}`, evo: kpis.versEvolution, color: "text-success" },
                { icon: "💰", label: "Solde trésorerie",   value: fmt(kpis.soldeTresorerie) + " F", sub: "Tous temps", evo: null, color: kpis.soldeTresorerie >= 0 ? "text-success" : "text-danger" },
              ].map((k, i) => (
                <div key={i} className="kpi-card">
                  <span className="kpi-icon">{k.icon}</span>
                  <p className="kpi-label">{k.label}</p>
                  <p className={clsx("kpi-value", k.color)}>{k.value}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-muted font-mono">{k.sub}</span>
                    {k.evo && <EvoTag val={k.evo} />}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Graphique ────────────────────────────────── */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="card-title">
                  {data.periode.nbJours > 60 ? "Évolution mensuelle" : "Évolution journalière"}
                </h2>
                <div className="flex items-center gap-4 text-xs font-mono text-muted">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#00d4ff" }} />CA ventes</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} />Dépenses</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={graphData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "DM Mono" }}
                    axisLine={false} tickLine={false}
                    interval={graphData.length > 20 ? Math.floor(graphData.length / 10) : 0} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10, fontFamily: "DM Mono" }}
                    axisLine={false} tickLine={false} tickFormatter={fmtM} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="ventes"   name="CA ventes"  fill="#00d4ff" radius={[4,4,0,0]} />
                  <Bar dataKey="depenses" name="Dépenses"   fill="#ef4444" radius={[4,4,0,0]} fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Vue financière globale (admin) ───────────── */}
            {vueFinanciere && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted">Vue financière globale</p>
                  <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    { icon: "📦", label: "Valeur stock",     value: fmt(vueFinanciere.valeurStock)    + " F", color: "" },
                    { icon: "🏧", label: "Solde en caisse",  value: fmt(vueFinanciere.soldeCaisseTotal) + " F", color: "text-success" },
                    { icon: "🛒", label: "Commandes dues",   value: fmt(vueFinanciere.commandesEnCours.totalDu) + " F", color: vueFinanciere.commandesEnCours.totalDu > 0 ? "text-warning" : "" },
                    { icon: "🏦", label: "En banque",        value: fmt(vueFinanciere.soldeBanqueTotal) + " F", color: "text-accent" },
                  ].map((k, i) => (
                    <div key={i} className="kpi-card">
                      <span className="kpi-icon">{k.icon}</span>
                      <p className="kpi-label">{k.label}</p>
                      <p className={clsx("kpi-value", k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>
                {/* Barre total actif */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="card-title">Total actif</h3>
                    <p className="text-2xl font-extrabold font-mono text-accent">{fmt(vueFinanciere.totalActif)} F</p>
                  </div>
                  {vueFinanciere.totalActif > 0 && (
                    <div className="space-y-3">
                      {[
                        { label: "Stock",   val: vueFinanciere.valeurStock,     color: "#00d4ff" },
                        { label: "Caisse",  val: vueFinanciere.soldeCaisseTotal, color: "#10b981" },
                        { label: "Banque",  val: vueFinanciere.soldeBanqueTotal, color: "#7c3aed" },
                      ].map((item, i) => {
                        const pct = Math.round((item.val / vueFinanciere.totalActif) * 100);
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-muted2">{item.label}</span>
                              <span style={{ color: item.color }}>{fmt(item.val)} F · {pct}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden bg-surface2">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Détail par boutique */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Stock par boutique</p>
                      {vueFinanciere.valeurStockParBoutique.map((b: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span className="text-fg2 flex items-center gap-1">{b.estPrincipale && <span className="text-accent text-[10px]">★</span>}{b.nom}</span>
                          <span className="font-mono font-semibold">{fmt(b.valeur)} F</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Caisse par boutique</p>
                      {vueFinanciere.soldesCaisseParBoutique.map((b: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span className="text-fg2 flex items-center gap-1">{b.estPrincipale && <span className="text-accent text-[10px]">★</span>}{b.nom}</span>
                          <span className="font-mono font-semibold text-success">{fmt(b.solde)} F</span>
                        </div>
                      ))}
                      {vueFinanciere.detailBanque.length > 0 && (
                        <>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted mt-3 mb-2">Banques</p>
                          {vueFinanciere.detailBanque.map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm py-1">
                              <span className="text-fg2">🏦 {b.banque}</span>
                              <span className="font-mono font-semibold" style={{ color: "#7c3aed" }}>{fmt(b.montant)} F</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Répartition par boutique + Alertes ──────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Répartition PDV */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">📊 Ventes par boutique</h2>
                  <span className="text-[11px] font-mono text-muted">Période sélectionnée</span>
                </div>
                {repartitionPDV.every((b: any) => b.total === 0) ? (
                  <div className="text-center py-10 text-muted font-mono text-sm">Aucune vente sur cette période</div>
                ) : (
                  <div className="px-5 pb-4 space-y-3 pt-2">
                    {repartitionPDV.filter((b: any) => b.total > 0).map((b: any, i: number) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-semibold" style={{ color: "var(--color-fg2)" }}>{b.nom}</span>
                          <span className="font-mono text-accent">{fmt(b.total)} F · {b.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-surface2">
                          <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple-500"
                            style={{ width: `${b.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alertes stock */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <span className={clsx("w-2 h-2 rounded-full inline-block mr-2",
                      alertesStock.length > 0 ? "bg-danger animate-pulse" : "bg-success")} />
                    Alertes stock
                  </h2>
                  <Link href="/alertes" className="text-xs font-mono text-accent hover:underline">Voir tout →</Link>
                </div>
                {alertesStock.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-muted font-mono text-sm">Tous les stocks sont OK</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                    {alertesStock.map((p: any) => (
                      <div key={p._id} className="flex items-center gap-3 px-5 py-3">
                        <div className={clsx("w-2 h-2 rounded-full shrink-0", p.totalQte === 0 ? "bg-danger" : "bg-warning")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-fg)" }}>{p.nom}</p>
                          <p className="text-xs font-mono text-muted">{p.reference} · seuil {p.seuilAlerte}</p>
                        </div>
                        <span className={clsx("font-mono font-bold text-sm shrink-0", p.totalQte === 0 ? "text-danger" : "text-warning")}>
                          {p.totalQte === 0 ? "Rupture" : `${p.totalQte} restants`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Dernières ventes ─────────────────────────── */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">🧾 Ventes récentes</h2>
                <Link href="/ventes" className="text-xs font-mono text-accent hover:underline">Voir tout →</Link>
              </div>
              {dernieresVentes.length === 0 ? (
                <div className="text-center py-10 text-muted font-mono text-sm">Aucune vente sur cette période</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                  {dernieresVentes.map((v: any) => (
                    <Link key={v._id} href={`/ventes/${v._id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
                          {v.employe ? `${v.employe.prenom} ${v.employe.nom}` : "—"}
                        </p>
                        <p className="text-xs font-mono text-muted">
                          {v.boutique?.nom} · {new Date(v.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={STATUT_BADGE[v.statut] ?? "badge-orange"}>{STATUT_LABEL[v.statut] ?? v.statut}</span>
                        <span className="font-mono font-bold text-sm text-accent">{fmt(v.montantTotal)} F</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
