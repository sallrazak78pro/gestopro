// app/(dashboard)/employes/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { KpiCard } from "@/components/ui/KpiCard";
import EmployeModal from "@/components/employes/EmployeModal";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function EmployesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "";

  const [employes, setEmployes]   = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filtreBoutique, setFiltreBoutique] = useState("");
  const [filtreActif, setFiltreActif]       = useState("true");
  const [showModal, setShowModal] = useState(false);
  const [editEmploye, setEdit]    = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [deleting, setDeleting]   = useState(false);

  // Classement des ventes par employé
  const [classement, setClassement] = useState<any[]>([]);
  const [classementLoading, setClassementLoading] = useState(true);
  const [statsDebut, setStatsDebut] = useState("");
  const [statsFin,   setStatsFin]   = useState("");
  const [statsBoutique, setStatsBoutique] = useState("");

  // Migration des anciennes ventes dont employe pointait vers User au lieu d'Employe
  const [toMigrer, setToMigrer]     = useState<number | null>(null);
  const [migrating, setMigrating]   = useState(false);
  const [migrateMsg, setMigrateMsg] = useState("");

  const fetchEmployes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filtreBoutique) params.set("boutique", filtreBoutique);
    if (filtreActif !== "") params.set("actif", filtreActif);
    const res  = await fetch(`/api/employes?${params}`);
    const json = await res.json();
    if (json.success) setEmployes(json.data);
    setLoading(false);
  }, [search, filtreBoutique, filtreActif]);

  const fetchClassement = useCallback(async () => {
    setClassementLoading(true);
    const params = new URLSearchParams();
    if (statsDebut)    params.set("debut",    statsDebut);
    if (statsFin)      params.set("fin",      statsFin);
    if (statsBoutique) params.set("boutique", statsBoutique);
    const res  = await fetch(`/api/employes/stats?${params}`);
    const json = await res.json();
    if (json.success) setClassement(json.data);
    setClassementLoading(false);
  }, [statsDebut, statsFin, statsBoutique]);

  useEffect(() => { fetchEmployes(); }, [fetchEmployes]);
  useEffect(() => { fetchClassement(); }, [fetchClassement]);
  useEffect(() => {
    if (!["admin", "superadmin"].includes(role)) return;
    fetch("/api/ventes/migrate-employe").then(r => r.json()).then(j => j.success && setToMigrer(j.count));
  }, [role]);
  useEffect(() => {
    // Tous les emplacements (boutiques ET dépôts) — un employé peut être
    // rattaché à un dépôt, le filtre/formulaire doit donc le proposer aussi.
    fetch("/api/boutiques").then(r => r.json())
      .then(j => j.success && setBoutiques(j.data));
  }, []);

  const actifs   = employes.filter(e => e.actif).length;
  const masseSal = employes.filter(e => e.actif).reduce((s, e) => s + e.salaireBase, 0);

  function openCreate() { setEdit(null); setShowModal(true); }
  function openEdit(e: any) { setEdit(e); setShowModal(true); }

  async function migrer() {
    setMigrating(true); setMigrateMsg("");
    const res  = await fetch("/api/ventes/migrate-employe", { method: "POST" });
    const json = await res.json();
    setMigrating(false);
    setMigrateMsg(json.message ?? (json.success ? "OK" : "Erreur"));
    if (json.success) { setToMigrer(0); fetchClassement(); }
  }

  async function reactiver(e: any) {
    await fetch(`/api/employes/${e._id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: true }),
    });
    fetchEmployes();
  }

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Employés actifs"  value={String(actifs)}         change="En activité"        trend="up"     icon="👥" />
        <KpiCard label="Masse salariale"  value={fmt(masseSal) + " F"}   change="Salaires de base"   trend="neutral" icon="💰" />
        <KpiCard label="Boutiques"        value={String(boutiques.length)} change="Points de vente"  trend="up"     icon="🏪" />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Gestion des employés</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Personnel de vos boutiques
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input w-44" placeholder="🔍  Nom, prénom, poste..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="select w-40" value={filtreBoutique} onChange={e => setFiltreBoutique(e.target.value)}>
              <option value="">Toutes boutiques</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
            <select className="select w-32" value={filtreActif} onChange={e => setFiltreActif(e.target.value)}>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
              <option value="">Tous</option>
            </select>
            <button className="btn-primary btn-sm" onClick={openCreate}>+ Ajouter</button>
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
          ) : employes.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-4xl">👥</p>
              <p className="text-muted font-mono text-sm">Aucun employé trouvé</p>
              <button className="btn-primary btn-sm" onClick={openCreate}>Ajouter le premier employé</button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Employé</th>
                  <th>Poste</th>
                  <th>Boutique</th>
                  <th>Téléphone</th>
                  <th>Date d&apos;embauche</th>
                  <th>Salaire de base</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employes.map(e => (
                  <tr key={e._id} className={!e.actif ? "opacity-50" : ""}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent2
                                        flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {e.prenom.charAt(0)}{e.nom.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{e.prenom} {e.nom}</p>
                          {e.userId && (
                            <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                              Compte actif
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-purple text-xs">{e.poste}</span>
                    </td>
                    <td className="text-sm text-muted2">{e.boutique?.nom}</td>
                    <td className="font-mono text-sm text-muted">{e.telephone || "—"}</td>
                    <td className="font-mono text-xs text-muted">
                      {new Date(e.dateEmbauche).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="font-mono font-bold">{fmt(e.salaireBase)} F</td>
                    <td>
                      {e.actif
                        ? <span className="badge-green">✓ Actif</span>
                        : <span className="badge-red">Inactif</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/employes/${e._id}`} className="btn-ghost btn-sm">👁</Link>
                        <button onClick={() => openEdit(e)} className="btn-ghost btn-sm">✏️</button>
                        {e.actif ? (
                          <button onClick={() => setConfirmDelete(e)}
                            className="btn-ghost btn-sm text-danger/70 hover:text-danger"
                            title="Désactiver l'employé">🗑️</button>
                        ) : (
                          <button onClick={() => reactiver(e)}
                            className="btn-ghost btn-sm text-success/70 hover:text-success"
                            title="Réactiver l'employé">↩️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && employes.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs font-mono text-muted">
              {employes.length} employé{employes.length > 1 ? "s" : ""}
            </p>
            <button onClick={fetchEmployes} className="btn-ghost btn-sm">🔄</button>
          </div>
        )}
      </div>

      {/* Bandeau migration */}
      {["admin", "superadmin"].includes(role) && !!toMigrer && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl px-5 py-3 flex flex-wrap items-center gap-3">
          <span className="text-warning text-sm">⚠</span>
          <p className="text-sm text-warning flex-1">
            {toMigrer} vente(s) ancienne(s) ont un lien employé incorrect — poste et boutique manquants dans le classement.
          </p>
          {migrateMsg && <span className="text-xs font-mono text-success">{migrateMsg}</span>}
          <button onClick={migrer} disabled={migrating}
            className="btn-sm bg-warning/20 hover:bg-warning/30 text-warning font-semibold px-4 py-2
                       rounded-xl transition-colors disabled:opacity-50 text-xs">
            {migrating ? "Migration en cours..." : "🔄 Corriger les ventes"}
          </button>
        </div>
      )}

      {/* Classement des ventes par employé */}
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">🏆 Classement des ventes</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Performance par employé sur la période
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="select w-44" value={statsBoutique} onChange={e => setStatsBoutique(e.target.value)}>
              <option value="">Toutes les boutiques</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
            <input type="date" className="input w-36" value={statsDebut}
              max={statsFin || undefined}
              onChange={e => setStatsDebut(e.target.value)} />
            <span className="text-muted text-xs">→</span>
            <input type="date" className="input w-36" value={statsFin}
              min={statsDebut || undefined}
              onChange={e => setStatsFin(e.target.value)} />
            {(statsDebut || statsFin) && (
              <button className="btn-ghost btn-sm" title="Réinitialiser les dates"
                onClick={() => { setStatsDebut(""); setStatsFin(""); }}>✕</button>
            )}
          </div>
        </div>

        <div className="table-wrapper">
          {classementLoading ? (
            <div className="flex items-center justify-center py-16 text-muted font-mono text-sm gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Calcul du classement...
            </div>
          ) : classement.length === 0 ? (
            <div className="text-center py-16 text-muted font-mono text-sm">
              Aucune vente sur la période sélectionnée
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Employé</th>
                  <th>Poste</th>
                  <th>Boutique</th>
                  <th className="text-right">Nb ventes</th>
                  <th className="text-right">CA généré</th>
                  <th className="text-right">Panier moyen</th>
                </tr>
              </thead>
              <tbody>
                {classement.map((c, i) => (
                  <tr key={c.employeId ?? c.nom}>
                    <td className="font-mono text-sm text-muted">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </td>
                    <td className="font-semibold text-sm">{c.nom}</td>
                    <td>{c.poste ? <span className="badge-purple text-xs">{c.poste}</span> : <span className="text-muted text-xs">—</span>}</td>
                    <td className="text-sm text-muted2">{c.boutique || "—"}</td>
                    <td className="text-right font-mono text-sm">{c.nbVentes}</td>
                    <td className="text-right font-mono font-bold text-accent">{fmt(c.totalCA)} F</td>
                    <td className="text-right font-mono text-sm text-muted">{fmt(c.panierMoyen)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <EmployeModal
          employe={editEmploye}
          boutiques={boutiques}
          onClose={() => { setShowModal(false); setEdit(null); }}
          onSaved={() => { setShowModal(false); setEdit(null); fetchEmployes(); }}
        />
      )}

      {/* Confirmation désactivation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="card w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-lg shrink-0">🗑️</div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: "var(--color-fg)" }}>Désactiver cet employé ?</h3>
                <p className="text-xs text-muted mt-0.5">Il n&apos;apparaîtra plus dans les listes actives — réversible.</p>
              </div>
            </div>
            <div className="bg-surface2 rounded-xl px-4 py-3 text-sm">
              <p className="font-semibold">{confirmDelete.prenom} {confirmDelete.nom}</p>
              <p className="text-xs text-muted mt-0.5">{confirmDelete.poste} — {confirmDelete.boutique?.nom}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Annuler
              </button>
              <button
                className="btn-sm bg-danger/90 hover:bg-danger text-white font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  await fetch(`/api/employes/${confirmDelete._id}`, { method: "DELETE" });
                  setDeleting(false);
                  setConfirmDelete(null);
                  fetchEmployes();
                }}
              >
                {deleting ? "Désactivation..." : "Oui, désactiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
