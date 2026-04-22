// components/mouvements/NouveauMouvementModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import clsx from "clsx";

interface Boutique { _id: string; nom: string; type: string; }
interface Produit  { _id: string; nom: string; reference: string; unite: string; prixAchat: number; }

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function NouveauMouvementModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep]         = useState<"type" | "details">("type");
  const [type, setType]         = useState<"entree" | "sortie" | "">("");
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [produits, setProduits]   = useState<Produit[]>([]);
  const [produitSearch, setProduitSearch] = useState("");
  const [stockDispo, setStockDispo]       = useState<number | null>(null);

  const [form, setForm] = useState({
    boutiqueId:    "",
    boutiqueDestId:"",     // only for transfer
    produitId:     "",
    quantite:      1,
    motif:         "",
    origineType:   "fournisseur" as "fournisseur" | "transfert",
    destType:      "transfert"   as "transfert"   | "perte"    | "autre",
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data));
  }, []);

  useEffect(() => {
    const p = new URLSearchParams({ search: produitSearch, limit: "20" });
    fetch(`/api/produits?${p}`).then(r => r.json()).then(j => j.success && setProduits(j.data));
  }, [produitSearch]);

  // Check stock when boutique + produit set (for sortie)
  useEffect(() => {
    if (type !== "sortie" || !form.boutiqueId || !form.produitId) { setStockDispo(null); return; }
    fetch(`/api/stock?boutique=${form.boutiqueId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const row = j.data.find((d: any) => d._id === form.produitId);
          setStockDispo(row ? (row.stocks[form.boutiqueId] ?? 0) : 0);
        }
      });
  }, [form.boutiqueId, form.produitId, type]);

  const selectedProduit = produits.find(p => p._id === form.produitId);
  const montant         = form.quantite * (selectedProduit?.prixAchat ?? 0);
  const isTransfer      = type === "sortie" && form.destType === "transfert";
  const autresBoutiques = boutiques.filter(b => b._id !== form.boutiqueId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const body: any = {
        type,
        boutiqueId:  form.boutiqueId,
        produitId:   form.produitId,
        quantite:    form.quantite,
        motif:       form.motif ||
          (type === "entree" && form.origineType === "fournisseur" ? "Réception fournisseur" :
           type === "entree" && form.origineType === "transfert"   ? "Transfert entrant" :
           form.destType === "perte"    ? "Perte / Casse" :
           form.destType === "autre"    ? "Sortie diverse" : "Transfert sortant"),
      };
      if (isTransfer)  body.boutiqueDestId = form.boutiqueDestId;

      const res  = await fetch("/api/mouvements-stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) { setError(json.message ?? "Erreur"); setLoading(false); return; }
      onSaved();
    } catch {
      setError("Erreur réseau"); setLoading(false);
    }
  }

  const canSubmit = form.boutiqueId && form.produitId && form.quantite > 0 &&
    (!isTransfer || !!form.boutiqueDestId) &&
    (type !== "sortie" || stockDispo === null || stockDispo >= form.quantite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card flex flex-col max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-base font-bold">Nouveau mouvement</h2>
            <div className="flex items-center gap-2 mt-1">
              {(["type","details"] as const).map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <div className="w-5 h-px bg-border" />}
                  <span className={clsx("text-[11px] font-mono flex items-center gap-1",
                    step === s ? "text-accent" : "text-muted")}>
                    <span className={clsx("w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                      step === s ? "bg-accent text-bg" : "bg-surface2")}>{i + 1}</span>
                    {s === "type" ? "Type" : "Détails"}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* STEP 1 — type */}
        {step === "type" && (
          <div className="p-6 space-y-3">
            <p className="text-sm text-muted mb-2">Quel mouvement veux-tu enregistrer ?</p>

            <button type="button"
              onClick={() => { setType("entree"); setStep("details"); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-success/40 bg-success/5 hover:border-success/70 hover:bg-success/10 transition-all text-left">
              <span className="text-3xl">📥</span>
              <div className="flex-1">
                <p className="font-bold text-success">Entrée de stock</p>
                <p className="text-xs text-muted mt-0.5">Réception fournisseur ou transfert entrant</p>
              </div>
              <span className="text-success text-lg">→</span>
            </button>

            <button type="button"
              onClick={() => { setType("sortie"); setStep("details"); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-danger/40 bg-danger/5 hover:border-danger/70 hover:bg-danger/10 transition-all text-left">
              <span className="text-3xl">📤</span>
              <div className="flex-1">
                <p className="font-bold text-danger">Sortie de stock</p>
                <p className="text-xs text-muted mt-0.5">Transfert vers une autre boutique, perte ou autre</p>
              </div>
              <span className="text-danger text-lg">→</span>
            </button>
          </div>
        )}

        {/* STEP 2 — détails */}
        {step === "details" && type && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Type badge */}
            <div className={clsx(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold",
              type === "entree"
                ? "border-success/40 bg-success/5 text-success"
                : "border-danger/40 bg-danger/5 text-danger"
            )}>
              <span className="text-xl">{type === "entree" ? "📥" : "📤"}</span>
              {type === "entree" ? "Entrée de stock" : "Sortie de stock"}
              <button type="button" onClick={() => setStep("type")}
                className="ml-auto text-xs font-mono text-muted underline hover:text-fg">Changer</button>
            </div>

            {/* Boutique concernée */}
            <div>
              <label className="input-label">
                {type === "entree" ? "Boutique qui reçoit *" : "Boutique qui sort *"}
              </label>
              <select className="select" value={form.boutiqueId} onChange={e => set("boutiqueId", e.target.value)} required>
                <option value="">Choisir une boutique...</option>
                {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
              </select>
            </div>

            {/* Origine / Destination */}
            {type === "entree" && (
              <div>
                <label className="input-label">Origine</label>
                <div className="flex gap-2">
                  {(["fournisseur","transfert"] as const).map(v => (
                    <button key={v} type="button"
                      onClick={() => set("origineType", v)}
                      className={clsx("flex-1 py-2 rounded-xl border text-xs font-semibold transition-all",
                        form.origineType === v
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface2 text-muted hover:border-border2"
                      )}>
                      {v === "fournisseur" ? "🏭 Fournisseur" : "🔀 Transfert"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type === "sortie" && (
              <div>
                <label className="input-label">Destination</label>
                <div className="flex gap-2 flex-wrap">
                  {(["transfert","perte","autre"] as const).map(v => (
                    <button key={v} type="button"
                      onClick={() => set("destType", v)}
                      className={clsx("flex-1 min-w-[90px] py-2 rounded-xl border text-xs font-semibold transition-all",
                        form.destType === v
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface2 text-muted hover:border-border2"
                      )}>
                      {v === "transfert" ? "🔀 Autre boutique" : v === "perte" ? "🗑️ Perte/Casse" : "📋 Autre"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Boutique destination (transfert only) */}
            {isTransfer && (
              <div>
                <label className="input-label">Boutique destinataire *</label>
                <select className="select" value={form.boutiqueDestId} onChange={e => set("boutiqueDestId", e.target.value)} required>
                  <option value="">Choisir...</option>
                  {autresBoutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
                </select>
                {form.boutiqueDestId && (
                  <p className="text-[11px] font-mono text-accent mt-1.5">
                    ↳ Une entrée sera automatiquement créée pour cette boutique
                  </p>
                )}
              </div>
            )}

            {/* Produit */}
            <div>
              <label className="input-label">Produit *</label>
              {selectedProduit ? (
                <div className="flex items-center justify-between bg-surface2 border border-border2 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-sm font-bold">{selectedProduit.nom}</p>
                    <p className="text-[10px] font-mono text-muted">
                      {selectedProduit.reference} · {selectedProduit.unite} · {fmt(selectedProduit.prixAchat)} F/u
                    </p>
                  </div>
                  <button type="button" onClick={() => { set("produitId", ""); setProduitSearch(""); }}
                    className="text-muted hover:text-danger text-lg">✕</button>
                </div>
              ) : (
                <>
                  <input className="input" placeholder="🔍  Rechercher un produit..."
                    value={produitSearch} onChange={e => setProduitSearch(e.target.value)} />
                  {produits.length > 0 && (
                    <div className="mt-1 bg-surface2 border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                      {produits.map(p => (
                        <button key={p._id} type="button"
                          onClick={() => { set("produitId", p._id); setProduitSearch(p.nom); }}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface border-b border-border/50 last:border-0 text-left">
                          <div>
                            <p className="text-sm font-semibold">{p.nom}</p>
                            <p className="text-[10px] font-mono text-muted">{p.reference}</p>
                          </div>
                          <span className="text-xs font-mono text-muted">{p.unite}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Stock dispo (sortie) */}
            {type === "sortie" && stockDispo !== null && (
              <div className={clsx("text-xs font-mono px-3 py-2 rounded-xl",
                stockDispo < form.quantite ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                Stock disponible : <strong>{fmt(stockDispo)}</strong>
                {stockDispo < form.quantite && " — INSUFFISANT"}
              </div>
            )}

            {/* Quantité */}
            <div>
              <label className="input-label">Quantité *</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => set("quantite", Math.max(0.001, form.quantite - 1))}
                  className="btn-ghost w-10 h-10 justify-center text-xl shrink-0">−</button>
                <input type="number" min={0.001} step="any" className="input text-center text-xl font-bold font-mono"
                  value={form.quantite} onChange={e => set("quantite", Math.max(0.001, +e.target.value))} required />
                <button type="button" onClick={() => set("quantite", form.quantite + 1)}
                  className="btn-ghost w-10 h-10 justify-center text-xl shrink-0">+</button>
              </div>
            </div>

            {/* Motif */}
            <div>
              <label className="input-label">Motif / Note</label>
              <input className="input" placeholder={
                type === "sortie" && form.destType === "perte" ? "ex: casse transport, vol, périmé..."
                : type === "entree" && form.origineType === "fournisseur" ? "ex: commande n°123..."
                : "Optionnel"
              } value={form.motif} onChange={e => set("motif", e.target.value)} />
            </div>

            {/* Récap */}
            {selectedProduit && form.boutiqueId && (
              <div className="bg-surface2 rounded-xl px-4 py-3 space-y-1.5 text-xs">
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Récapitulatif</p>
                <div className="flex justify-between">
                  <span className="text-muted">Boutique</span>
                  <span className="font-semibold">{boutiques.find(b => b._id === form.boutiqueId)?.nom}</span>
                </div>
                {isTransfer && form.boutiqueDestId && (
                  <div className="flex justify-between">
                    <span className="text-muted">→ Destination</span>
                    <span className="font-semibold">{boutiques.find(b => b._id === form.boutiqueDestId)?.nom}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">Produit</span>
                  <span className="font-semibold">{selectedProduit.nom}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-muted">Quantité</span>
                  <span className="font-mono font-extrabold text-accent">{fmt(form.quantite)} {selectedProduit.unite}</span>
                </div>
                {montant > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted">Valeur</span>
                    <span className="font-mono font-bold">{fmt(montant)} F</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">⚠ {error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep("type")} className="btn-ghost flex-1 justify-center">← Retour</button>
              <button type="submit" disabled={loading || !canSubmit}
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                {loading ? "Enregistrement..." : "✓ Valider"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
