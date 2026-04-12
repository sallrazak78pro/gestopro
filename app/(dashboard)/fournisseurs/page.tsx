// app/(dashboard)/fournisseurs/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import FournisseurModal from "@/components/fournisseurs/FournisseurModal";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [stats, setStats]   = useState({ totalDette: 0, nbActifs: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editF, setEditF]         = useState<any>(null);

  const fetchF = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/fournisseurs?${params}`);
    const json = await res.json();
    if (json.success) { setFournisseurs(json.data); setStats(json.stats); }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchF(); }, [fetchF]);

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Fournisseurs actifs" value={String(stats.nbActifs)}         change="En activité"          trend="up"      icon="🏭" />
        <KpiCard label="Dette totale"         value={fmt(stats.totalDette) + " F"}  change="Montant total dû"     trend={stats.totalDette > 0 ? "down" : "up"} icon="💳" />
        <KpiCard label="Total fournisseurs"   value={String(fournisseurs.length)}   change="Dans votre carnet"    trend="up"      icon="📋" />
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Carnet des fournisseurs</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Vos partenaires commerciaux
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input className="input w-48" placeholder="🔍  Nom, contact..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-primary btn-sm" onClick={() => { setEditF(null); setShowModal(true); }}>
              + Fournisseur
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
          ) : fournisseurs.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <p className="text-4xl">🏭</p>
              <p className="text-muted font-mono text-sm">Aucun fournisseur enregistré</p>
              <button className="btn-primary btn-sm" onClick={() => { setEditF(null); setShowModal(true); }}>
                Ajouter le premier fournisseur
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fournisseur</th>
                  <th>Contact</th>
                  <th>Téléphone</th>
                  <th>Ville</th>
                  <th>Dette en cours</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fournisseurs.map(f => (
                  <tr key={f._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent2
                                        flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {f.nom.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{f.nom}</p>
                          {f.email && <p className="text-[10px] font-mono text-muted">{f.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{f.contact || "—"}</td>
                    <td className="font-mono text-sm text-muted">{f.telephone || "—"}</td>
                    <td className="text-sm text-muted2">{f.ville || "—"}</td>
                    <td>
                      <span className={f.soldeCredit > 0 ? "font-mono font-bold text-danger" : "font-mono text-muted"}>
                        {f.soldeCredit > 0 ? fmt(f.soldeCredit) + " F" : "—"}
                      </span>
                    </td>
                    <td>
                      {f.actif ? <span className="badge-green">✓ Actif</span> : <span className="badge-red">Inactif</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/fournisseurs/${f._id}`} className="btn-ghost btn-sm">👁</Link>
                        <button onClick={() => { setEditF(f); setShowModal(true); }} className="btn-ghost btn-sm">✏️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && fournisseurs.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs font-mono text-muted">{fournisseurs.length} fournisseur{fournisseurs.length > 1 ? "s" : ""}</p>
            <button onClick={fetchF} className="btn-ghost btn-sm">🔄</button>
          </div>
        )}
      </div>

      {showModal && (
        <FournisseurModal
          fournisseur={editF}
          onClose={() => { setShowModal(false); setEditF(null); }}
          onSaved={() => { setShowModal(false); setEditF(null); fetchF(); }}
        />
      )}
    </div>
  );
}
