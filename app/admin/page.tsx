// app/admin/page.tsx — Dashboard Super Admin
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function AdminDashboardPage() {
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(j => { if (j.success) setStats(j); })
      .finally(() => setLoading(false));
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

  const s = stats?.stats ?? {};
  const chartData = (stats?.parMois ?? []).map((m: any) => ({ mois: m._id, inscriptions: m.count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-fg)" }}>
          Tableau de bord
        </h1>
        <p className="text-sm text-muted mt-1">Vue globale de la plateforme GestoPro</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: "🏢", label: "Total entreprises",    value: fmt(s.totalTenants ?? 0),         color: "text-accent" },
          { icon: "✅", label: "Entreprises actives",  value: fmt(s.tenantsActifs ?? 0),         color: "text-success" },
          { icon: "🟢", label: "Connectées maintenant",value: fmt(s.entreprisesConnectees ?? 0), color: "text-success" },
          { icon: "🚫", label: "Suspendues",           value: fmt(s.tenantsSuspendus ?? 0),      color: "text-danger" },
        ].map((k, i) => (
          <div key={i} className="kpi-card">
            <span className="kpi-icon">{k.icon}</span>
            <p className="kpi-label">{k.label}</p>
            <p className={`kpi-value ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="kpi-card">
          <span className="kpi-icon">👤</span>
          <p className="kpi-label">Total utilisateurs</p>
          <p className="kpi-value">{fmt(s.totalUsers ?? 0)}</p>
          <p className="text-[10px] font-mono text-muted mt-1">Toutes entreprises</p>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon">🧾</span>
          <p className="kpi-label">Total ventes</p>
          <p className="kpi-value text-accent">{fmt(s.totalVentes ?? 0)}</p>
          <p className="text-[10px] font-mono text-muted mt-1">Sur toute la plateforme</p>
        </div>
      </div>

      {/* Graphique */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h2 className="card-title mb-4">Nouvelles inscriptions — 6 derniers mois</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="mois" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border2)", borderRadius: 10, fontFamily: "DM Mono", fontSize: 12 }} />
              <Bar dataKey="inscriptions" name="Inscriptions" fill="#00d4ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dernières inscriptions */}
      {stats?.derniersInscrits?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Dernières inscriptions</h2>
            <Link href="/admin/entreprises" className="text-xs font-mono text-accent hover:underline">Voir toutes →</Link>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {stats.derniersInscrits.map((t: any) => (
              <div key={t._id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                  style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)" }}>
                  {t.nom.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-fg)" }}>{t.nom}</p>
                  <p className="text-[11px] font-mono text-muted">{t.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={t.statut === "actif" ? "badge-green" : t.statut === "suspendu" ? "badge-red" : "badge-orange"}>{t.statut}</span>
                  <p className="text-[10px] font-mono text-muted mt-1">{new Date(t.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
