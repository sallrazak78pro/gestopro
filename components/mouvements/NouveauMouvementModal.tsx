// components/mouvements/NouveauMouvementModal.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";

interface Boutique { _id: string; nom: string; type: "boutique" | "depot"; }
interface Produit  { _id: string; nom: string; reference: string; unite: string; }

const TYPES = [
  {
    value: "depot_vers_boutique",
    label: "Dépôt → Boutique",
    icon: "📦",
    desc: "Approvisionner une boutique depuis le dépôt",
    color: "border-accent/50 bg-accent/5 text-accent",
  },
  {
    value: "boutique_vers_boutique",
    label: "Boutique → Boutique",
    icon: "🔀",
    desc: "Transférer de la marchandise entre deux boutiques",
    color: "border-purple-500/50 bg-purple-500/5 text-purple-400",
  },
  {
    value: "entree_fournisseur",
    label: "Entrée fournisseur",
    icon: "🏭",
    desc: "Réceptionner une livraison d'un fournisseur",
    color: "border-success/50 bg-success/5 text-success",
  },
  {
    value: "sortie_perte",
    label: "Sortie / Perte / Casse",
    icon: "🗑️",
    desc: "Retirer du stock (perte, vol, casse, expiration)",
    color: "border-danger/50 bg-danger/5 text-danger",
  },
];

export default function NouveauMouvementModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void; }) {
  const { submit } = useOfflineQueue();
  const [step, setStep] = useState<"type" | "details">("type");
  const [type, setType] = useState("");
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [produitSearch, setProduitSearch] = useState("");
  const [form, setForm] = useState({
    produitId: "", sourceId: "", destinationId: "",
    quantite: 1, motif: "",
  });
  const [stockSource, setStockSource] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ search: produitSearch });
    fetch(`/api/produits?${params}`).then(r => r.json()).then(j => j.success && setProduits(j.data));
  }, [produitSearch]);

  // Vérifier le stock source quand produit + source changent
  useEffect(() => {
    if (!form.produitId || !form.sourceId) { setStockSource(null); return; }
    fetch(`/api/stock?boutique=${form.sourceId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const row = j.data.find((d: any) => d._id === form.produitId);
          setStockSource(row ? (row.stocks[form.sourceId] ?? 0) : 0);
        }
      });
  }, [form.produitId, form.sourceId]);

  const depots    = boutiques.filter(b => b.type === "depot");
  const boutiquesOnly = boutiques.filter(b => b.type === "boutique");

  // Déduire source / destination selon le type
  function getSourceOptions() {
    if (type === "depot_vers_boutique")    return depots;
    if (type === "boutique_vers_boutique") return boutiquesOnly;
    if (type === "sortie_perte")           return boutiques;
    return [];
  }
  function getDestOptions() {
    if (type === "depot_vers_boutique")    return boutiquesOnly.filter(b => b._id !== form.sourceId);
    if (type === "boutique_vers_boutique") return boutiquesOnly.filter(b => b._id !== form.sourceId);
    if (type === "entree_fournisseur")     return boutiques; // peut entrer dans dépôt ou boutique
    return [];
  }

  const hasSource = ["depot_vers_boutique", "boutique_vers_boutique", "sortie_perte"].includes(type);
  const hasDest   = ["depot_vers_boutique", "boutique_vers_boutique", "entree_fournisseur"].includes(type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const selectedProduitLocal = produits.find(p => p._id === form.produitId);
    const selectedTypeLocal    = TYPES.find(t => t.value === type);
    const result = await submit({
      endpoint: "/api/mouvements-stock",
      method:   "POST",
      body:     { type, ...form },
      label:    `${selectedTypeLocal?.label ?? "Mouvement"} — ${selectedProduitLocal?.nom ?? "Produit"} × ${form.quantite}`,
      module:   "mouvements",
    });
    setLoading(false);
    if (!result.ok) { setError((result as any).error ?? "Une erreur est survenue."); return; }
    onSaved();
  }

  const selectedType = TYPES.find(t => t.value === type);
  const selectedProduit = produits.find(p => p._id === form.produitId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg card animate-slide-up flex flex-col max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-lg font-bold">Nouveau mouvement</h2>
            <div className="flex items-center gap-2 mt-1">
              {["type", "details"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-6 h-px bg-border" />}
                  <span className={clsx("flex items-center gap-1.5 text-xs font-mono",
                    step === s ? "text-accent" : "text-muted"
                  )}>
                    <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      step === s ? "bg-accent text-bg" : "bg-surface2 text-muted"
                    )}>{i + 1}</span>
                    {s === "type" ? "Type" : "Détails"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* STEP 1 — choix du type */}
        {step === "type" && (
          <div className="p-6 space-y-3">
            <p className="text-sm text-muted mb-4">Quel type de mouvement veux-tu enregistrer ?</p>
            {TYPES.map(t => (
              <button key={t.value} type="button"
                onClick={() => { setType(t.value); setStep("details"); setForm({ produitId: "", sourceId: "", destinationId: "", quantite: 1, motif: "" }); }}
                className={clsx(
                  "w-full flex items-start gap-4 px-4 py-4 rounded-xl border-2 text-left",
                  "transition-all hover:-translate-y-0.5",
                  t.color
                )}
              >
                <span className="text-3xl shrink-0">{t.icon}</span>
                <div>
                  <p className="font-bold text-sm">{t.label}</p>
                  <p className="text-xs mt-0.5 opacity-80">{t.desc}</p>
                </div>
                <span className="ml-auto text-lg opacity-60">→</span>
              </button>
            ))}
          </div>
        )}

        {/* STEP 2 — détails */}
        {step === "details" && selectedType && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Type sélectionné */}
            <div className={clsx("flex items-center gap-3 px-4 py-3 rounded-xl border-2", selectedType.color)}>
              <span className="text-2xl">{selectedType.icon}</span>
              <div>
                <p className="font-bold text-sm">{selectedType.label}</p>
                <p className="text-[11px] opacity-80">{selectedType.desc}</p>
              </div>
              <button type="button" onClick={() => setStep("type")}
                className="ml-auto text-xs font-mono underline opacity-70 hover:opacity-100">
                Changer
              </button>
            </div>

            {/* Produit */}
            <div>
              <label className="input-label">Produit *</label>
              <input className="input mb-2" placeholder="🔍  Rechercher un produit..."
                value={produitSearch} onChange={e => setProduitSearch(e.target.value)} />
              {produits.length > 0 && !selectedProduit && (
                <div className="bg-surface2 border border-border rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                  {produits.map(p => (
                    <button key={p._id} type="button"
                      onClick={() => { set("produitId", p._id); setProduitSearch(p.nom); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface
                                 border-b border-border/50 last:border-0 text-left transition-colors">
                      <div>
                        <p className="text-sm font-semibold">{p.nom}</p>
                        <p className="text-[10px] font-mono text-muted">{p.reference}</p>
                      </div>
                      <span className="text-xs text-muted font-mono">{p.unite}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduit && (
                <div className="flex items-center justify-between bg-surface2 border border-border2 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-sm font-bold">{selectedProduit.nom}</p>
                    <p className="text-[10px] font-mono text-muted">{selectedProduit.reference} · {selectedProduit.unite}</p>
                  </div>
                  <button type="button" onClick={() => { set("produitId", ""); setProduitSearch(""); }}
                    className="text-muted hover:text-danger text-lg transition-colors">✕</button>
                </div>
              )}
            </div>

            {/* Source */}
            {hasSource && (
              <div>
                <label className="input-label">
                  {type === "sortie_perte" ? "Retirer du stock de *" : "Source (d'où part la marchandise) *"}
                </label>
                <select className="select" value={form.sourceId}
                  onChange={e => set("sourceId", e.target.value)} required>
                  <option value="">Choisir...</option>
                  {getSourceOptions().map(b => (
                    <option key={b._id} value={b._id}>{b.nom} ({b.type})</option>
                  ))}
                </select>
                {/* Stock dispo */}
                {stockSource !== null && (
                  <div className={clsx("mt-1.5 text-xs font-mono px-3 py-1.5 rounded-lg",
                    stockSource < form.quantite
                      ? "bg-danger/10 text-danger"
                      : "bg-success/10 text-success"
                  )}>
                    Stock disponible : <strong>{stockSource}</strong> unité{stockSource > 1 ? "s" : ""}
                    {stockSource < form.quantite && " — INSUFFISANT"}
                  </div>
                )}
              </div>
            )}

            {/* Destination */}
            {hasDest && (
              <div>
                <label className="input-label">
                  {type === "entree_fournisseur" ? "Réceptionner dans *" : "Destination (où arrive la marchandise) *"}
                </label>
                <select className="select" value={form.destinationId}
                  onChange={e => set("destinationId", e.target.value)} required>
                  <option value="">Choisir...</option>
                  {getDestOptions().map(b => (
                    <option key={b._id} value={b._id}>{b.nom} ({b.type})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantité */}
            <div>
              <label className="input-label">Quantité *</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => set("quantite", Math.max(0.001, +((form.quantite - 1).toFixed(3))))}
                  className="btn-ghost w-11 h-11 justify-center text-xl shrink-0">−</button>
                <input type="number" min={0.001} step="0.001" className="input text-center text-xl font-bold font-mono"
                  value={form.quantite} onChange={e => set("quantite", Math.max(0.001, +e.target.value))} required />
                <button type="button" onClick={() => set("quantite", +((form.quantite + 1).toFixed(3)))}
                  className="btn-ghost w-11 h-11 justify-center text-xl shrink-0">+</button>
              </div>
              {selectedProduit && (
                <p className="text-[11px] text-muted font-mono mt-1 text-center">
                  {form.quantite} {selectedProduit.unite}{form.quantite > 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Motif */}
            <div>
              <label className="input-label">Motif / Observation</label>
              <input className="input" placeholder={
                type === "sortie_perte" ? "ex: casse transport, vol, périmé..."
                : type === "entree_fournisseur" ? "ex: commande n°123, fournisseur Tech+"
                : "Raison du transfert (optionnel)"
              } value={form.motif} onChange={e => set("motif", e.target.value)} />
            </div>

            {/* Récap */}
            {form.produitId && form.quantite > 0 && (
              <div className="bg-surface2 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Récapitulatif</p>
                <div className="flex justify-between">
                  <span className="text-muted">Opération</span>
                  <span className="font-semibold">{selectedType.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Produit</span>
                  <span className="font-semibold">{selectedProduit?.nom}</span>
                </div>
                {form.sourceId && (
                  <div className="flex justify-between">
                    <span className="text-muted">De</span>
                    <span className="font-semibold">{boutiques.find(b => b._id === form.sourceId)?.nom}</span>
                  </div>
                )}
                {form.destinationId && (
                  <div className="flex justify-between">
                    <span className="text-muted">Vers</span>
                    <span className="font-semibold">{boutiques.find(b => b._id === form.destinationId)?.nom}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-muted">Quantité</span>
                  <span className="font-mono font-extrabold text-accent">{form.quantite} {selectedProduit?.unite}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                ⚠ {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep("type")} className="btn-ghost flex-1 justify-center">
                ← Retour
              </button>
              <button type="submit"
                disabled={loading || !form.produitId || (hasSource && !form.sourceId) || (hasDest && !form.destinationId)
                  || (stockSource !== null && stockSource < form.quantite)}
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                {loading ? "Enregistrement..." : "✓ Valider le mouvement"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
