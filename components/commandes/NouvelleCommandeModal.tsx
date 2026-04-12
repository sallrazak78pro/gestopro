// components/commandes/NouvelleCommandeModal.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const DEVISES = [
  { code: "FCFA", nom: "Franc CFA (FCFA)", taux: 1 },
  { code: "USD",  nom: "Dollar américain (USD)" },
  { code: "EUR",  nom: "Euro (EUR)" },
  { code: "CNY",  nom: "Yuan chinois (CNY)" },
  { code: "GBP",  nom: "Livre sterling (GBP)" },
  { code: "MAD",  nom: "Dirham marocain (MAD)" },
  { code: "GNF",  nom: "Franc guinéen (GNF)" },
  { code: "XOF",  nom: "Franc CFA BCEAO (XOF)" },
];

interface Ligne {
  produitId:         string | null;
  nomProduit:        string;
  reference:         string;
  quantite:          number;
  prixUnitaireDevise:number;
}
interface Frais { libelle: string; montantDevise: number; }

export default function NouvelleCommandeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<"infos" | "lignes" | "frais" | "recap">("infos");

  // Infos générales
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [boutiques, setBoutiques]       = useState<any[]>([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [boutiqueId, setBoutiqueId]     = useState("");
  const [devise, setDevise]             = useState("FCFA");
  const [tauxEchange, setTaux]          = useState<number>(1);
  const [dateReceptionPrevue, setDatePrev] = useState("");
  const [notes, setNotes]               = useState("");

  // Lignes
  const [produits, setProduits]         = useState<any[]>([]);
  const [searchProd, setSearchProd]     = useState("");
  const [lignes, setLignes]             = useState<Ligne[]>([]);

  // Frais
  const [frais, setFrais] = useState<Frais[]>([{ libelle: "Transport", montantDevise: 0 }]);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/fournisseurs").then(r => r.json()),
      fetch("/api/boutiques?type=boutique").then(r => r.json()),
    ]).then(([f, b]) => {
      if (f.success) setFournisseurs(f.data);
      if (b.success) { setBoutiques(b.data); if (b.data.length === 1) setBoutiqueId(b.data[0]._id); }
    });
  }, []);

  useEffect(() => {
    if (!searchProd.trim()) { setProduits([]); return; }
    fetch(`/api/produits?search=${searchProd}`)
      .then(r => r.json())
      .then(j => j.success && setProduits(j.data));
  }, [searchProd]);

  // Taux auto selon la devise du fournisseur sélectionné
  useEffect(() => {
    if (devise === "FCFA") setTaux(1);
  }, [devise]);

  // Calculs
  const taux = tauxEchange || 1;
  const totalHTDevise  = lignes.reduce((s, l) => s + l.prixUnitaireDevise * l.quantite, 0);
  const totalHTFCFA    = totalHTDevise * taux;
  const totalFraisFCFA = frais.reduce((s, f) => s + f.montantDevise * taux, 0);
  const totalTTC       = totalHTFCFA + totalFraisFCFA;

  function ajouterProduit(p: any) {
    const exist = lignes.find(l => l.produitId === p._id);
    if (!exist) {
      setLignes(prev => [...prev, {
        produitId: p._id, nomProduit: p.nom, reference: p.reference,
        quantite: 1, prixUnitaireDevise: devise === "FCFA" ? p.prixAchat : 0,
      }]);
    }
    setSearchProd(""); setProduits([]);
    searchRef.current?.focus();
  }

  function addLigneManuelle() {
    setLignes(prev => [...prev, { produitId: null, nomProduit: "", reference: "", quantite: 1, prixUnitaireDevise: 0 }]);
  }

  function removeLigne(i: number) { setLignes(prev => prev.filter((_, idx) => idx !== i)); }
  function updateLigne(i: number, k: keyof Ligne, v: any) {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  function addFrais()  { setFrais(prev => [...prev, { libelle: "", montantDevise: 0 }]); }
  function removeFrais(i: number) { setFrais(prev => prev.filter((_, idx) => idx !== i)); }
  function updateFrais(i: number, k: keyof Frais, v: any) {
    setFrais(prev => prev.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  }

  const { submit } = useOfflineQueue();

  async function handleSubmit() {
    setError(""); setLoading(true);
    const totalFmt = new Intl.NumberFormat("fr-FR").format(
      lignes.reduce((s, l) => s + l.quantite * l.prixUnitaireDevise * taux, 0)
    );
    const result = await submit({
      endpoint: "/api/commandes",
      method:   "POST",
      body: {
        boutiqueDestination: boutiqueId,
        fournisseurId,
        devise, tauxEchange: taux,
        lignes: lignes.map(l => ({
          produitId: l.produitId,
          nomProduit: l.nomProduit,
          reference: l.reference,
          quantite: l.quantite,
          prixUnitaireDevise: l.prixUnitaireDevise,
        })),
        frais: frais.filter(f => f.libelle && f.montantDevise > 0),
        dateReceptionPrevue: dateReceptionPrevue || undefined,
        notes,
      },
      label:  `Commande fournisseur — ${lignes.length} article(s) — ${totalFmt} F`,
      module: "commandes",
    });
    setLoading(false);
    if (!result.ok) { setError((result as any).error ?? "Une erreur est survenue."); return; }
    onSaved();
  }

  const STEPS = ["infos", "lignes", "frais", "recap"];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl card animate-slide-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold">Nouvelle commande fournisseur</h2>
            <div className="flex items-center gap-2 mt-1">
              {["Infos", "Produits", "Frais", "Récap"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className={clsx("w-6 h-px", i <= stepIdx ? "bg-accent/50" : "bg-border")} />}
                  <span className={clsx("flex items-center gap-1 text-xs font-mono",
                    i === stepIdx ? "text-accent" : "text-muted")}>
                    <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      i === stepIdx ? "bg-accent text-bg" : i < stepIdx ? "bg-success text-white" : "bg-surface2 text-muted")}>
                      {i < stepIdx ? "✓" : i + 1}
                    </span>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ── ÉTAPE 1 : INFOS ─── */}
          {step === "infos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Fournisseur *</label>
                  <select className="select" value={fournisseurId} onChange={e => {
                    setFournisseurId(e.target.value);
                    const f = fournisseurs.find(f => f._id === e.target.value);
                    if (f?.devise) setDevise(f.devise);
                  }}>
                    <option value="">Choisir un fournisseur...</option>
                    {fournisseurs.map(f => (
                      <option key={f._id} value={f._id}>{f.nom} ({f.pays})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Boutique de destination *</label>
                  <select className="select" value={boutiqueId} onChange={e => setBoutiqueId(e.target.value)}>
                    <option value="">Choisir une boutique...</option>
                    {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
                  </select>
                </div>
              </div>

              {/* Devise + taux */}
              <div>
                <label className="input-label">Devise de la commande *</label>
                <div className="grid grid-cols-2 gap-3">
                  <select className="select" value={devise} onChange={e => setDevise(e.target.value)}>
                    {DEVISES.map(d => <option key={d.code} value={d.code}>{d.nom}</option>)}
                  </select>
                  <div>
                    <input
                      type="number" min={0} step="0.01"
                      className="input"
                      placeholder="Taux d'échange"
                      value={devise === "FCFA" ? 1 : tauxEchange}
                      onChange={e => setTaux(parseFloat(e.target.value) || 1)}
                      disabled={devise === "FCFA"}
                    />
                    <p className="text-[10px] font-mono text-muted mt-1">
                      {devise === "FCFA"
                        ? "Pas de conversion nécessaire"
                        : `1 ${devise} = ${fmt(taux)} FCFA`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Date de réception prévue</label>
                  <input type="date" className="input"
                    value={dateReceptionPrevue} onChange={e => setDatePrev(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Notes</label>
                  <input className="input" placeholder="Observation..."
                    value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button"
                  disabled={!fournisseurId || !boutiqueId}
                  onClick={() => setStep("lignes")}
                  className="btn-primary disabled:opacity-50">
                  Produits →
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : PRODUITS ─── */}
          {step === "lignes" && (
            <div className="space-y-4">
              {/* Recherche */}
              <div>
                <label className="input-label">Ajouter un produit du catalogue</label>
                <input ref={searchRef} className="input" placeholder="🔍  Rechercher un produit..."
                  value={searchProd} onChange={e => setSearchProd(e.target.value)} />
                {produits.length > 0 && (
                  <div className="bg-surface2 border border-border rounded-xl mt-1 overflow-hidden max-h-44 overflow-y-auto">
                    {produits.map(p => (
                      <button key={p._id} type="button" onClick={() => ajouterProduit(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface
                                   border-b border-border/50 last:border-0 text-left text-sm transition-colors">
                        <span className="font-semibold">{p.nom}</span>
                        <span className="font-mono text-xs text-muted">{p.reference} · PA: {fmt(p.prixAchat)} F</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lignes */}
              {lignes.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1">
                    <p className="col-span-4 text-[10px] font-mono text-muted uppercase">Produit</p>
                    <p className="col-span-2 text-[10px] font-mono text-muted uppercase text-center">Qté</p>
                    <p className="col-span-3 text-[10px] font-mono text-muted uppercase text-center">
                      Prix ({devise})
                    </p>
                    <p className="col-span-2 text-[10px] font-mono text-muted uppercase text-right">S/Total FCFA</p>
                    <div className="col-span-1" />
                  </div>
                  {lignes.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-surface2 rounded-xl px-3 py-2">
                      <div className="col-span-4">
                        {l.produitId ? (
                          <p className="text-sm font-semibold truncate">{l.nomProduit}</p>
                        ) : (
                          <input className="input text-sm py-1.5" placeholder="Nom du produit"
                            value={l.nomProduit} onChange={e => updateLigne(i, "nomProduit", e.target.value)} />
                        )}
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={0} step="0.001" className="input text-center text-sm py-1.5 font-mono font-bold"
                          value={l.quantite} onChange={e => updateLigne(i, "quantite", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-3">
                        <input type="number" min={0} step="0.01" className="input text-center text-sm py-1.5 font-mono"
                          value={l.prixUnitaireDevise}
                          onChange={e => updateLigne(i, "prixUnitaireDevise", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="font-mono text-sm font-bold">{fmt(l.prixUnitaireDevise * l.quantite * taux)} F</p>
                      </div>
                      <div className="col-span-1 text-right">
                        <button type="button" onClick={() => removeLigne(i)}
                          className="text-muted hover:text-danger transition-colors text-sm">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" onClick={addLigneManuelle}
                className="w-full py-2.5 rounded-xl border border-dashed border-border text-muted text-sm hover:text-white hover:border-border2 transition-colors">
                + Ajouter un produit manuellement (non enregistré)
              </button>

              {/* Total HT */}
              {lignes.length > 0 && (
                <div className="flex justify-between items-center bg-surface2 rounded-xl px-4 py-3">
                  <span className="text-sm text-muted">Total HT</span>
                  <div className="text-right">
                    <p className="font-mono font-bold">{fmt(totalHTFCFA)} F</p>
                    {devise !== "FCFA" && (
                      <p className="text-xs font-mono text-muted">{fmt(totalHTDevise)} {devise}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-between">
                <button type="button" onClick={() => setStep("infos")} className="btn-ghost">← Retour</button>
                <button type="button" disabled={lignes.length === 0} onClick={() => setStep("frais")} className="btn-primary disabled:opacity-50">
                  Frais →
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 : FRAIS ─── */}
          {step === "frais" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Ajoutez tous les frais de la commande. Ils seront répartis proportionnellement sur le prix de revient de chaque produit.
              </p>

              <div className="space-y-3">
                {frais.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-surface2 rounded-xl px-4 py-3">
                    <input className="input flex-1 text-sm py-2" placeholder="Libellé (ex: Transport, Douane...)"
                      value={f.libelle} onChange={e => updateFrais(i, "libelle", e.target.value)} />
                    <div className="relative w-44 shrink-0">
                      <input type="number" min={0} step="0.01"
                        className="input text-sm py-2 font-mono pr-16"
                        placeholder="0"
                        value={f.montantDevise}
                        onChange={e => updateFrais(i, "montantDevise", parseFloat(e.target.value) || 0)} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted">{devise}</span>
                    </div>
                    {devise !== "FCFA" && (
                      <span className="text-xs font-mono text-muted shrink-0 w-28 text-right">
                        = {fmt(f.montantDevise * taux)} F
                      </span>
                    )}
                    <button type="button" onClick={() => removeFrais(i)}
                      className="text-muted hover:text-danger transition-colors shrink-0">✕</button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addFrais}
                className="w-full py-2.5 rounded-xl border border-dashed border-border text-muted text-sm hover:text-white hover:border-border2 transition-colors">
                + Ajouter un frais
              </button>

              {/* Impact par produit */}
              {lignes.length > 0 && totalFraisFCFA > 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                  <p className="text-[10px] font-mono text-warning uppercase tracking-widest mb-2">
                    Répartition estimée des frais ({fmt(totalFraisFCFA)} F)
                  </p>
                  {lignes.map((l, i) => {
                    const stFCFA = l.prixUnitaireDevise * l.quantite * taux;
                    const prop   = totalHTFCFA > 0 ? stFCFA / totalHTFCFA : 0;
                    const fraisLigne = prop * totalFraisFCFA;
                    const fraisUnit  = l.quantite > 0 ? fraisLigne / l.quantite : 0;
                    return (
                      <div key={i} className="flex justify-between text-xs py-1 border-b border-border/50 last:border-0">
                        <span className="text-muted2 truncate">{l.nomProduit || "—"}</span>
                        <span className="font-mono text-warning shrink-0 ml-2">
                          +{fmt(fraisUnit)} F/unité
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 justify-between">
                <button type="button" onClick={() => setStep("lignes")} className="btn-ghost">← Retour</button>
                <button type="button" onClick={() => setStep("recap")} className="btn-primary">
                  Récapitulatif →
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 4 : RÉCAP ─── */}
          {step === "recap" && (
            <div className="space-y-5">
              <p className="text-sm text-muted">Vérifiez avant de créer la commande.</p>

              {/* Infos */}
              <div className="bg-surface2 rounded-xl p-4 space-y-2 text-sm">
                {[
                  { k: "Fournisseur",  v: fournisseurs.find(f => f._id === fournisseurId)?.nom },
                  { k: "Destination", v: boutiques.find(b => b._id === boutiqueId)?.nom },
                  { k: "Devise",      v: devise !== "FCFA" ? `${devise} (1 = ${fmt(taux)} FCFA)` : "FCFA" },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted">{r.k}</span>
                    <span className="font-semibold">{r.v}</span>
                  </div>
                ))}
              </div>

              {/* Lignes */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest">{lignes.length} produit{lignes.length > 1 ? "s" : ""}</p>
                {lignes.map((l, i) => (
                  <div key={i} className="flex justify-between text-sm bg-surface2 rounded-lg px-3 py-2">
                    <span>{l.nomProduit} × {l.quantite}</span>
                    <span className="font-mono font-semibold">{fmt(l.prixUnitaireDevise * l.quantite * taux)} F</span>
                  </div>
                ))}
              </div>

              {/* Frais */}
              {frais.filter(f => f.montantDevise > 0).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Frais</p>
                  {frais.filter(f => f.montantDevise > 0).map((f, i) => (
                    <div key={i} className="flex justify-between text-sm bg-surface2 rounded-lg px-3 py-2">
                      <span className="text-warning">{f.libelle}</span>
                      <span className="font-mono font-semibold text-warning">{fmt(f.montantDevise * taux)} F</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Totaux */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted">Total HT</span><span className="font-mono">{fmt(totalHTFCFA)} F</span></div>
                <div className="flex justify-between text-sm"><span className="text-warning">Total frais</span><span className="font-mono text-warning">+{fmt(totalFraisFCFA)} F</span></div>
                <div className="flex justify-between bg-accent/10 border border-accent/30 rounded-xl px-4 py-3">
                  <span className="font-bold">Total TTC</span>
                  <span className="font-mono font-extrabold text-xl text-accent">{fmt(totalTTC)} F</span>
                </div>
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">⚠ {error}</div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep("frais")} className="btn-ghost flex-1 justify-center">← Retour</button>
                <button type="button" onClick={handleSubmit} disabled={loading}
                  className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {loading ? "Création..." : "✓ Créer la commande"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
