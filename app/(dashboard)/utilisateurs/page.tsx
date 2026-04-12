// app/(dashboard)/utilisateurs/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { KpiCard } from "@/components/ui/KpiCard";
import UtilisateurModal from "@/components/utilisateurs/UtilisateurModal";
import clsx from "clsx";

const ROLE_CONFIG: Record<string, { label: string; badge: string; desc: string; icon: string }> = {
  admin:        { label: "Admin",        badge: "badge-red",    icon: "👑", desc: "Accès complet à tout" },
  gestionnaire: { label: "Gestionnaire", badge: "badge-blue",   icon: "📦", desc: "Stock et mouvements" },
  caissier:     { label: "Caissier",     badge: "badge-green",  icon: "💵", desc: "Ventes uniquement" },
};

export default function UtilisateursPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;
  const currentRole   = (session?.user as any)?.role;

  const [users, setUsers]         = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [stats, setStats]         = useState({ total: 0, nbActifs: 0, nbInactifs: 0 });
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser]   = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res  = await fetch(`/api/utilisateurs?${params}`);
    const json = await res.json();
    if (json.success) {
      setUsers(json.data);
      setStats(json.stats);
      setBoutiques(json.boutiques);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function toggleActif(user: any) {
    setActionLoading(user._id);
    await fetch(`/api/utilisateurs/${user._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !user.actif }),
    });
    await fetchUsers();
    setActionLoading(null);
  }

  function openEdit(user: any) { setEditUser(user); setShowModal(true); }
  function openCreate() { setEditUser(null); setShowModal(true); }

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total utilisateurs" value={String(stats.total)} change="Dans votre espace" trend="up" icon="👥" />
        <KpiCard label="Actifs" value={String(stats.nbActifs)} change="Peuvent se connecter" trend="up" icon="✅" />
        <KpiCard label="Inactifs" value={String(stats.nbInactifs)} change="Accès suspendu" trend={stats.nbInactifs > 0 ? "neutral" : "up"} icon="🔒" />
      </div>

      {/* Rôles expliqués */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
          <div key={role} className="card p-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">{cfg.icon}</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold">{cfg.label}</span>
                <span className={cfg.badge}>{role}</span>
              </div>
              <p className="text-xs text-muted">{cfg.desc}</p>
              <div className="mt-2 space-y-0.5">
                {role === "admin" && (
                  <>
                    <p className="text-[10px] text-success font-mono">✓ Tout gérer</p>
                    <p className="text-[10px] text-success font-mono">✓ Gérer les utilisateurs</p>
                    <p className="text-[10px] text-success font-mono">✓ Voir la trésorerie</p>
                  </>
                )}
                {role === "gestionnaire" && (
                  <>
                    <p className="text-[10px] text-success font-mono">✓ Stock & mouvements</p>
                    <p className="text-[10px] text-success font-mono">✓ Voir les ventes</p>
                    <p className="text-[10px] text-danger font-mono">✗ Gérer les utilisateurs</p>
                  </>
                )}
                {role === "caissier" && (
                  <>
                    <p className="text-[10px] text-success font-mono">✓ Créer des ventes</p>
                    <p className="text-[10px] text-danger font-mono">✗ Voir la trésorerie</p>
                    <p className="text-[10px] text-danger font-mono">✗ Modifier le stock</p>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Gestion des utilisateurs</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Membres de votre espace GestoPro
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input w-48"
              placeholder="🔍  Nom ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn-primary btn-sm" onClick={openCreate}>
              + Ajouter un utilisateur
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
          ) : users.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">👤</p>
              <p className="text-muted font-mono text-sm">Aucun utilisateur trouvé</p>
              <button className="btn-primary btn-sm" onClick={openCreate}>
                Ajouter le premier utilisateur
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Boutique assignée</th>
                  <th>Statut</th>
                  <th>Membre depuis</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isMe = u._id === currentUserId;
                  const rc   = ROLE_CONFIG[u.role];
                  return (
                    <tr key={u._id} className={clsx(!u.actif && "opacity-50")}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0",
                            u.actif ? "bg-gradient-accent" : "bg-surface2 border border-border"
                          )}>
                            {u.nom.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">
                              {u.nom}
                              {isMe && (
                                <span className="ml-2 text-[10px] font-mono text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded">
                                  Vous
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted">{u.email}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span>{rc?.icon}</span>
                          <span className={rc?.badge}>{rc?.label}</span>
                        </div>
                      </td>
                      <td>
                        {u.boutique ? (
                          <div>
                            <p className="text-sm font-medium">{u.boutique.nom}</p>
                            <p className="text-[10px] font-mono text-muted capitalize">{u.boutique.type}</p>
                          </div>
                        ) : (
                          <span className="text-muted text-xs font-mono">Toutes boutiques</span>
                        )}
                      </td>
                      <td>
                        {u.actif
                          ? <span className="badge-green">✓ Actif</span>
                          : <span className="badge-red">✗ Inactif</span>}
                      </td>
                      <td className="font-mono text-xs text-muted">
                        {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td>
                        {!isMe ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(u)}
                              className="btn-ghost btn-sm"
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => toggleActif(u)}
                              disabled={actionLoading === u._id}
                              className={clsx(
                                "btn-sm disabled:opacity-50",
                                u.actif ? "btn-danger" : "btn-success"
                              )}
                            >
                              {actionLoading === u._id ? "..." : u.actif ? "🔒 Désactiver" : "🔓 Activer"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && users.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs font-mono text-muted">
              {users.length} utilisateur{users.length > 1 ? "s" : ""}
            </p>
            <button onClick={fetchUsers} className="btn-ghost btn-sm">🔄 Actualiser</button>
          </div>
        )}
      </div>

      {showModal && (
        <UtilisateurModal
          user={editUser}
          boutiques={boutiques}
          currentRole={currentRole}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSaved={() => { setShowModal(false); setEditUser(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}
