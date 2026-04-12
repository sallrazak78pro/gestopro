// app/admin/entreprises/page.tsx — Gestion des entreprises
"use client";
import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const STATUT_BADGE: Record<string, string> = {
  actif: "badge-green", suspendu: "badge-red", essai: "badge-orange",
};

export default function EntreprisesPage() {
  const [tenants,       setTenants]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filtreStatut,  setFiltreStatut]  = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)       params.set("search", search);
    if (filtreStatut) params.set("statut", filtreStatut);
    const res  = await fetch(`/api/admin/tenants?${params}`);
    const json = await res.json();
    if (json.success) setTenants(json.data);
    setLoading(false);
  }, [search, filtreStatut]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  async function changeStatut(id: string, statut: string) {
    setActionLoading(id);
    await fetch(`/api/admin/tenants/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    await fetchTenants();
    setActionLoading(null);
  }

  async function supprimer(id: string, nom: string) {
    if (!confirm(`Supprimer définitivement "${nom}" ?\n\nToutes ses données seront effacées. Cette action est irréversible.`)) return;
    setActionLoading(id);
    await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
    await fetchTenants();
    setActionLoading(null);
  }

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-fg)" }}>
            Entreprises
          </h1>
          <p className="text-sm text-muted mt-1">
            {tenants.length} entreprise{tenants.length > 1 ? "s" : ""} enregistrée{tenants.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input className="input flex-1 min-w-48" placeholder="🔍 Rechercher par nom ou email..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select w-40" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="actif">Actifs</option>
          <option value="suspendu">Suspendus</option>
          <option value="essai">En essai</option>
        </select>
        <button onClick={fetchTenants} className="btn-ghost btn-sm">🔄 Actualiser</button>
      </div>

      {/* Tableau */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted font-mono text-sm gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Chargement...
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏢</p>
            <p className="text-muted font-mono text-sm">Aucune entreprise trouvée</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Entreprise</th>
                    <th>Contact</th>
                    <th>Pays</th>
                    <th className="text-center">Boutiques</th>
                    <th className="text-center">Utilisateurs</th>
                    <th className="text-right">CA total</th>
                    <th>Statut</th>
                    <th>Inscrit le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(t => (
                    <tr key={t._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
                            style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)" }}>
                            {t.nom.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: "var(--color-fg)" }}>{t.nom}</p>
                            <p className="text-[10px] font-mono text-muted">{t.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-sm" style={{ color: "var(--color-fg2)" }}>{t.email}</p>
                        {t.telephone && <p className="text-[10px] font-mono text-muted">{t.telephone}</p>}
                      </td>
                      <td className="font-mono text-sm text-muted">{t.pays ?? "—"}</td>
                      <td className="font-mono text-sm text-center">{t.nbBoutiques ?? 0}</td>
                      <td className="font-mono text-sm text-center">{t.nbUsers ?? 0}</td>
                      <td className="font-mono text-sm text-right text-accent">
                        {fmt(t.caTotal ?? 0)} F
                      </td>
                      <td>
                        <span className={STATUT_BADGE[t.statut] ?? "badge-orange"}>{t.statut}</span>
                      </td>
                      <td className="font-mono text-xs text-muted">
                        {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {t.statut === "actif" ? (
                            <button
                              onClick={() => changeStatut(t._id, "suspendu")}
                              disabled={actionLoading === t._id}
                              className="btn-danger btn-sm disabled:opacity-50">
                              {actionLoading === t._id ? "..." : "🚫 Suspendre"}
                            </button>
                          ) : (
                            <button
                              onClick={() => changeStatut(t._id, "actif")}
                              disabled={actionLoading === t._id}
                              className="btn-success btn-sm disabled:opacity-50">
                              {actionLoading === t._id ? "..." : "✓ Activer"}
                            </button>
                          )}
                          <button
                            onClick={() => supprimer(t._id, t.nom)}
                            disabled={actionLoading === t._id}
                            title="Supprimer définitivement"
                            className="btn-ghost btn-sm text-danger hover:bg-danger/10 disabled:opacity-50">
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t text-xs font-mono text-muted" style={{ borderColor: "var(--color-border)" }}>
              {tenants.length} résultat{tenants.length > 1 ? "s" : ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
