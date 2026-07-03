// app/(dashboard)/stock/[id]/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { formatMontant } from "@/lib/utils/devise";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function ProduitDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editPrixId, setEditPrixId] = useState<string | null>(null);
  const [prixSaving, setPrixSaving] = useState(false);

  const fetchData = () => fetch(`/api/produits/${id}`)
    .then(r => r.json())
    .then(json => { if (json.success) setData(json.data); })
    .finally(() => setLoading(false));

  useEffect(() => { fetchData(); }, [id]);

  async function savePrixVente(boutiqueId: string, prixVente: number) {
    setPrixSaving(true);
    await fetch("/api/stock/prix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produitId: id, boutiqueId, prixVente }),
    });
    await fetchData();
    setPrixSaving(false);
    setEditPrixId(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted font-mono text-sm">
      <svg className="animate-spin w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Chargement...
    </div>
  );

  if (!data) return (
    <div className="text-center py-20 text-muted font-mono">Produit introuvable</div>
  );

  const { produit, stocks } = data;
  const totalQte = stocks.reduce((s: number, st: any) => s + st.quantite, 0);
  const marge = produit.prixVente - produit.prixAchat;
  const margePct = ((marge / produit.prixAchat) * 100).toFixed(1);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button onClick={() => router.back()} className="btn-ghost btn-sm">
        ← Retour au stock
      </button>

      {/* Header produit */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="badge-blue font-mono text-xs">{produit.reference}</span>
              <span className="badge-purple text-xs">{produit.categorie}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{produit.nom}</h1>
            {produit.description && (
              <p className="text-sm text-muted mt-1">{produit.description}</p>
            )}
          </div>
          <button className="btn-ghost btn-sm">✏️ Modifier</button>
        </div>

        {/* Stats produit */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { label: "Prix d'achat", value: fmt(produit.prixAchat) + " F", color: "text-muted2" },
            { label: "Prix de vente", value: fmt(produit.prixVente) + " F", color: "text-white" },
            { label: "Marge brute", value: `+${fmt(marge)} F (${margePct}%)`, color: "text-success" },
            { label: "Unité", value: produit.unite, color: "text-accent" },
          ].map((s, i) => (
            <div key={i} className="bg-surface2 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">{s.label}</p>
              <p className={clsx("text-sm font-bold font-mono", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock par emplacement */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Stock par emplacement</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              Total · <span className="text-accent font-bold">{totalQte} unité(s)</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {stocks.length === 0 ? (
            <p className="text-muted font-mono text-sm col-span-3 py-4 text-center">
              Aucun stock enregistré
            </p>
          ) : stocks.map((s: any) => {
            const alerte = s.quantite > 0 && s.quantite <= produit.seuilAlerte;
            const vide = s.quantite === 0;
            const devise = s.boutique.devise || "FCFA";
            return (
              <div key={s._id}
                className={clsx("rounded-xl border px-5 py-4 transition-all",
                  vide ? "border-border bg-surface2"
                  : alerte ? "border-danger/30 bg-danger/5"
                  : "border-success/20 bg-success/5"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold">{s.boutique.nom}</p>
                    <p className="text-[10px] font-mono text-muted uppercase">{s.boutique.type} · {devise}</p>
                  </div>
                  {vide ? <span className="badge-orange">Vide</span>
                    : alerte ? <span className="badge-red">⚠ Alerte</span>
                    : <span className="badge-green">✓ OK</span>}
                </div>
                <p className={clsx("text-3xl font-extrabold font-mono",
                  vide ? "text-muted" : alerte ? "text-danger" : "text-success"
                )}>
                  {s.quantite}
                </p>
                <p className="text-xs text-muted font-mono mt-1">
                  Seuil d&apos;alerte : {produit.seuilAlerte}
                </p>

                {/* Prix de vente propre à cette boutique */}
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Prix de vente</p>
                  {editPrixId === s._id ? (
                    <input type="number" min={0} step={devise === "FCFA" ? 1 : 0.01} autoFocus
                      className="input text-sm font-mono py-1.5"
                      defaultValue={s.prixVente ?? 0}
                      disabled={prixSaving}
                      onBlur={e => savePrixVente(s.boutique._id, parseFloat(e.target.value) || 0)}
                      onKeyDown={e => {
                        if (e.key === "Enter") savePrixVente(s.boutique._id, parseFloat((e.target as HTMLInputElement).value) || 0);
                        if (e.key === "Escape") setEditPrixId(null);
                      }}
                    />
                  ) : (
                    <button type="button" onClick={() => setEditPrixId(s._id)}
                      className="font-mono font-bold text-sm hover:text-accent transition-colors">
                      {s.prixVente != null ? formatMontant(s.prixVente, devise) : "— définir"}
                      <span className="ml-2 text-[10px] font-normal text-muted">✏️</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
