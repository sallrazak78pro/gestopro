// app/(dashboard)/stock/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import ProduitModal from "@/components/stock/ProduitModal";
import ImportExcelModal from "@/components/stock/ImportExcelModal";
import ExportButton from "@/components/ui/ExportButton";
import AjustementModal from "@/components/stock/AjustementModal";
import clsx from "clsx";
import PrintButton from "@/components/ui/PrintButton";

interface Boutique { _id: string; nom: string; type: string; }
interface StockRow {
  image?: string;
  _id: string; reference: string; nom: string; categorie: string;
  prixVente: number; seuilAlerte: number; stocks: Record<string, number>;
  total: number; enAlerte: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtreAlerte, setFiltreAlerte] = useState(false);
  const [filtreCat, setFiltreCat] = useState("");
  const [showProduitModal, setShowProduitModal] = useState(false);
  const [showImportModal, setShowImportModal]   = useState(false);
  const [editProduit, setEditProduit]           = useState<any>(null);
  const [ajustement, setAjustement] = useState<{ produit: StockRow; boutique: Boutique } | null>(null);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtreAlerte) params.set("alertes", "true");
    const res = await fetch(`/api/stock?${params}`);
    const json = await res.json();
    if (json.success) {
      setRows(json.data);
      setBoutiques(json.boutiques);
    }
    setLoading(false);
  }, [filtreAlerte]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const categories = [...new Set(rows.map(r => r.categorie))].sort();

  const filtered = rows.filter(r => {
    const matchSearch = r.nom.toLowerCase().includes(search.toLowerCase())
      || r.reference.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filtreCat || r.categorie === filtreCat;
    return matchSearch && matchCat;
  });

  const totalProduits = rows.length;
  const totalUnites = rows.reduce((s, r) => s + r.total, 0);
  const nbAlertes = rows.filter(r => r.enAlerte).length;
  const valeurStock = rows.reduce((s, r) => s + r.total * r.prixVente, 0);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Références actives" value={String(totalProduits)} change="Produits catalogués" trend="up" icon="🗂️" />
        <KpiCard label="Total unités" value={fmt(totalUnites)} change="Tous emplacements" trend="up" icon="📦" />
        <KpiCard label="Valeur du stock" value={fmt(valeurStock) + " F"} change="Prix de vente" trend="up" icon="💎" />
        <KpiCard label="Alertes stock" value={String(nbAlertes)} change={nbAlertes > 0 ? "Réapprovisionnement urgent" : "Tout est bon"} trend={nbAlertes > 0 ? "down" : "up"} icon={nbAlertes > 0 ? "🔴" : "✅"} />
      </div>

      {/* Tableau inventaire */}
      <div className="card">
        {/* Header */}
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="card-title">Inventaire par emplacement</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              Stock en temps réel · tous points de vente et dépôts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <input
              className="input w-48"
              placeholder="🔍  Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {/* Catégorie filter */}
            <select
              className="select w-40"
              value={filtreCat}
              onChange={e => setFiltreCat(e.target.value)}
            >
              <option value="">Toutes catégories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Alerte toggle */}
            <button
              onClick={() => setFiltreAlerte(!filtreAlerte)}
              className={clsx("btn btn-sm", filtreAlerte ? "btn-danger" : "btn-ghost")}
            >
              ⚠ Alertes {filtreAlerte ? "ON" : "OFF"}
            </button>
            {/* Nouveau produit */}
            <PrintButton href="/print/stock" label="🖨️ État stocks" />
            <ExportButton type="stock" />
            <button className="btn-ghost btn-sm" onClick={() => setShowImportModal(true)}>
              📥 Import Excel
            </button>
            <button className="btn-primary btn-sm" onClick={() => setShowProduitModal(true)}>
              + Produit
            </button>
          </div>
        </div>

        {/* Légende des emplacements */}
        <div className="flex flex-wrap gap-3 px-5 py-3 border-b border-border bg-surface2/50">
          {boutiques.map((b, i) => (
            <div key={b._id} className="flex items-center gap-1.5 text-xs font-mono text-muted2">
              <span className="w-2 h-2 rounded-sm"
                style={{ background: ["#00d4ff","#7c3aed","#10b981","#f59e0b","#ef4444"][i] }} />
              {b.nom}
              {b.type === "depot" && (
                <span className="badge-purple text-[9px] py-0 px-1.5">Dépôt</span>
              )}
            </div>
          ))}
          <div className="ml-auto flex gap-3 text-[10px] font-mono">
            <span className="text-success">■ Normal</span>
            <span className="text-danger">■ Alerte</span>
            <span className="text-muted">■ Vide</span>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted font-mono text-sm">
              <svg className="animate-spin w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Chargement du stock...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted font-mono text-sm">
              Aucun produit trouvé
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  {boutiques.map(b => <th key={b._id}>{b.nom}</th>)}
                  <th>Total</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row._id} className={row.enAlerte ? "bg-danger/[0.02]" : ""}>
                    <td className="font-mono text-xs text-accent">{row.reference}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {/* Miniature image */}
                        <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-sm"
                          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
                          {row.image
                            ? <img src={row.image} alt={row.nom} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            : "📦"}
                        </div>
                        <span className="font-semibold">{row.nom}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge-purple text-[10px]">{row.categorie}</span>
                    </td>
                    {boutiques.map(b => {
                      const qte = row.stocks[b._id] ?? 0;
                      const alerte = qte > 0 && qte <= row.seuilAlerte;
                      const vide = qte === 0;
                      return (
                        <td key={b._id}>
                          <button
                            onClick={() => setAjustement({ produit: row, boutique: b })}
                            className={clsx(
                              "font-mono text-xs font-medium px-3 py-1 rounded-md transition-all",
                              "hover:ring-1 hover:ring-accent/50 cursor-pointer",
                              vide ? "bg-white/5 text-muted"
                              : alerte ? "bg-danger/10 text-danger"
                              : "bg-success/10 text-success"
                            )}
                            title="Cliquer pour ajuster"
                          >
                            {qte}
                          </button>
                        </td>
                      );
                    })}
                    <td className="font-mono font-bold text-accent">{fmt(row.total)}</td>
                    <td>
                      {row.enAlerte ? (
                        <span className="badge-red">⚠ Alerte</span>
                      ) : row.total === 0 ? (
                        <span className="badge-orange">Rupture</span>
                      ) : (
                        <span className="badge-green">✓ Normal</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={async () => {
                          const res  = await fetch(`/api/produits/${row._id}`);
                          const json = await res.json();
                          if (json.success) setEditProduit(json.data.produit ?? json.data);
                        }}
                      >✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs font-mono text-muted">
              {filtered.length} produit{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
            </p>
            <button onClick={fetchStock} className="btn-ghost btn-sm">
              🔄 Actualiser
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showProduitModal && (
        <ProduitModal
          onClose={() => setShowProduitModal(false)}
          onSaved={() => { setShowProduitModal(false); fetchStock(); }}
        />
      )}
      {editProduit && (
        <ProduitModal
          produit={editProduit}
          onClose={() => setEditProduit(null)}
          onSaved={() => { setEditProduit(null); fetchStock(); }}
        />
      )}
      {showImportModal && (
        <ImportExcelModal
          onClose={() => setShowImportModal(false)}
          onSaved={() => { setShowImportModal(false); fetchStock(); }}
        />
      )}
      {ajustement && (
        <AjustementModal
          produit={ajustement.produit}
          boutique={ajustement.boutique}
          quantiteActuelle={ajustement.produit.stocks[ajustement.boutique._id] ?? 0}
          onClose={() => setAjustement(null)}
          onSaved={() => { setAjustement(null); fetchStock(); }}
        />
      )}

    </div>
  );
}
