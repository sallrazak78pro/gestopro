// components/mouvements/NouveauMouvementModal.tsx
"use client";
import React, { useState, useEffect } from "react";
import clsx from "clsx";

interface Boutique { _id: string; nom: string; type: string; }
interface Produit  { _id: string; nom: string; reference: string; unite: string; prixAchat: number; }

interface LigneUI {
  key:       string;
  produitId: string;
  produit:   Produit | null;
  search:    string;
  quantite:  number;
}

const fmt    = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const newKey = () => Math.random().toString(36).slice(2);

const SOURCE_EXTERNE = "__externe__";
const DEST_PERTE     = "__perte__";

function emptyLigne(): LigneUI {
  return { key: newKey(), produitId: "", produit: null, search: "", quantite: 1 };
}

export default function NouveauMouvementModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {

  const [boutiques,  setBoutiques]  = useState<Boutique[]>([]);
  const [allProduits,setAllProduits]= useState<Produit[]>([]);
  const [stockMap,   setStockMap]   = useState<Record<string, number>>({});

  const [sourceId, setSourceId] = useState(SOURCE_EXTERNE);
  const [destId,   setDestId]   = useState("");
  const [lignes,   setLignes]   = useState<LigneUI[]>([emptyLigne()]);
  const [motif,    setMotif]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // Charger boutiques
  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data));
  }, []);

  // Charger tous les produits (une seule fois, filtrage côté client)
  useEffect(() => {
    fetch("/api/produits?limit=300").then(r => r.json()).then(j => j.success && setAllProduits(j.data));
  }, []);

  // Charger le stock de la boutique source dès qu'elle change
  useEffect(() => {
    if (!sourceId || sourceId === SOURCE_EXTERNE) { setStockMap({}); return; }
    fetch(`/api/stock?boutique=${sourceId}`)
      .then(r => r.json())
      .then(j => {
        if (!j.success) return;
        const map: Record<string, number> = {};
        for (const row of j.data) {
          map[row._id] = row.stocks?.[sourceId] ?? 0;
        }
        setStockMap(map);
      });
  }, [sourceId]);

  // ── Options sélecteurs ────────────────────────────────────────────────────
  const sourceOptions = [
    { value: SOURCE_EXTERNE, label: "🏭 Fournisseur / Externe", sub: "Entrée sans origine interne" },
    ...boutiques.map(b => ({ value: b._id, label: b.nom, sub: b.type })),
  ];
  const destOptions = [
    ...boutiques.filter(b => b._id !== sourceId).map(b => ({ value: b._id, label: b.nom, sub: b.type })),
    { value: DEST_PERTE, label: "🗑️ Perte / Casse / Sortie", sub: "Sortie sans destination interne" },
  ];

  const sourceName = sourceOptions.find(o => o.value === sourceId)?.label ?? "—";
  const destName   = destOptions.find(o => o.value === destId)?.label ?? "—";

  const mouvDesc = !destId ? null
    : sourceId === SOURCE_EXTERNE && destId === DEST_PERTE ? null
    : sourceId === SOURCE_EXTERNE
      ? { label: "Entrée",    color: "text-success", icon: "📥", detail: `Réception dans ${destName}` }
      : destId === DEST_PERTE
        ? { label: "Sortie",  color: "text-danger",  icon: "📤", detail: `Sortie depuis ${sourceName}` }
        : { label: "Transfert",color: "text-accent", icon: "🔀", detail: `${sourceName} → ${destName}` };

  // ── Gestion lignes ────────────────────────────────────────────────────────
  const updateLigne = (key: string, patch: Partial<LigneUI>) =>
    setLignes(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));

  const removeLigne = (key: string) =>
    setLignes(prev => prev.filter(l => l.key !== key));

  const addLigne = () => setLignes(prev => [...prev, emptyLigne()]);

  const selectProduit = (ligneKey: string, p: Produit) => {
    updateLigne(ligneKey, { produitId: p._id, produit: p, search: p.nom });
  };

  const clearProduit = (ligneKey: string) =>
    updateLigne(ligneKey, { produitId: "", produit: null, search: "" });

  // ── Calculs ───────────────────────────────────────────────────────────────
  const lignesValides = lignes.filter(l => l.produitId && l.quantite > 0);
  const montantTotal  = lignes.reduce((s, l) => s + l.quantite * (l.produit?.prixAchat ?? 0), 0);

  const stockInsuffisant = (l: LigneUI) =>
    sourceId !== SOURCE_EXTERNE && l.produitId
      ? (stockMap[l.produitId] ?? 0) < l.quantite
      : false;

  const hasStockError = lignes.some(l => stockInsuffisant(l));

  const canSubmit =
    destId &&
    !(sourceId === SOURCE_EXTERNE && destId === DEST_PERTE) &&
    lignesValides.length > 0 &&
    lignesValides.length === lignes.length && // toutes les lignes doivent être remplies
    !hasStockError;

  // ── Soumission ────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(""); setLoading(true);
    try {
      const body = {
        sourceId: sourceId === SOURCE_EXTERNE ? null : sourceId,
        destId:   destId   === DEST_PERTE     ? null : destId,
        lignes:   lignes.map(l => ({ produitId: l.produitId, quantite: l.quantite })),
        motif: motif || (
          sourceId === SOURCE_EXTERNE ? "Réception fournisseur" :
          destId   === DEST_PERTE     ? "Perte / Casse" :
          "Transfert"
        ),
      };
      const res  = await fetch("/api/mouvements-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) { setError(json.message ?? "Erreur"); setLoading(false); return; }
      onSaved();
    } catch {
      setError("Erreur réseau"); setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl card flex flex-col max-h-[94vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-base font-bold">Nouveau mouvement</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              Plusieurs produits possibles par mouvement
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── DE → VERS ── */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">

            {/* Source */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">De</label>
              <select className="select w-full" value={sourceId}
                onChange={e => { setSourceId(e.target.value); setDestId(""); }} required>
                {sourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-[10px] font-mono text-muted capitalize">
                {sourceOptions.find(o => o.value === sourceId)?.sub}
              </p>
            </div>

            {/* Flèche */}
            <div className="flex flex-col items-center justify-center pt-6">
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg",
                mouvDesc
                  ? mouvDesc.label === "Entrée"    ? "bg-success/20 text-success"
                  : mouvDesc.label === "Sortie"    ? "bg-danger/20 text-danger"
                  : "bg-accent/20 text-accent"
                  : "bg-surface2 text-muted"
              )}>→</div>
            </div>

            {/* Destination */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">Vers</label>
              <select className="select w-full" value={destId}
                onChange={e => setDestId(e.target.value)} required>
                <option value="">Choisir...</option>
                {destOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {destId && (
                <p className="text-[10px] font-mono text-muted capitalize">
                  {destOptions.find(o => o.value === destId)?.sub}
                </p>
              )}
            </div>
          </div>

          {/* Badge type mouvement */}
          {mouvDesc && (
            <div className={clsx(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-semibold",
              mouvDesc.label === "Entrée"    ? "border-success/30 bg-success/5 text-success"
            : mouvDesc.label === "Sortie"   ? "border-danger/30  bg-danger/5  text-danger"
            : "border-accent/30  bg-accent/5   text-accent"
            )}>
              <span className="text-lg">{mouvDesc.icon}</span>
              <div>
                <p>{mouvDesc.label}</p>
                <p className="text-[11px] font-normal opacity-80">{mouvDesc.detail}</p>
              </div>
              {mouvDesc.label === "Transfert" && (
                <span className="ml-auto text-[10px] font-mono opacity-70">2 docs créés automatiquement</span>
              )}
            </div>
          )}

          {sourceId === SOURCE_EXTERNE && destId === DEST_PERTE && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-xs px-4 py-2.5 rounded-xl">
              ⚠ Impossible : sélectionne au moins une boutique interne.
            </div>
          )}

          {/* ── Lignes produits ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wider">
                Produits *
                <span className="ml-2 normal-case text-accent font-semibold">
                  {lignes.length} ligne{lignes.length > 1 ? "s" : ""}
                </span>
              </label>
            </div>

            {lignes.map((ligne, idx) => (
              <LigneRow
                key={ligne.key}
                ligne={ligne}
                idx={idx}
                allProduits={allProduits}
                stockMap={stockMap}
                showStock={sourceId !== SOURCE_EXTERNE && !!sourceId}
                canRemove={lignes.length > 1}
                onUpdate={patch => updateLigne(ligne.key, patch)}
                onSelect={p => selectProduit(ligne.key, p)}
                onClear={() => clearProduit(ligne.key)}
                onRemove={() => removeLigne(ligne.key)}
              />
            ))}

            <button type="button" onClick={addLigne}
              className="w-full border-2 border-dashed border-border hover:border-accent text-muted hover:text-accent
                         rounded-xl py-2.5 text-sm font-mono transition-colors flex items-center justify-center gap-2">
              + Ajouter un produit
            </button>
          </div>

          {/* Motif */}
          <div>
            <label className="input-label">Motif / Note</label>
            <input className="input" placeholder="Optionnel"
              value={motif} onChange={e => setMotif(e.target.value)} />
          </div>

          {/* Récap */}
          {canSubmit && (
            <div className="bg-surface2 rounded-xl px-4 py-3 space-y-1.5 text-xs">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Récapitulatif</p>
              <div className="flex justify-between">
                <span className="text-muted">De</span>
                <span className="font-semibold">{sourceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Vers</span>
                <span className="font-semibold">{destName}</span>
              </div>
              <div className="border-t border-border pt-1.5 space-y-1">
                {lignes.map(l => l.produit && (
                  <div key={l.key} className="flex justify-between font-mono">
                    <span className="text-muted truncate max-w-[180px]">{l.produit.nom}</span>
                    <span className="font-bold text-accent ml-2 shrink-0">
                      {fmt(l.quantite)} {l.produit.unite}
                    </span>
                  </div>
                ))}
              </div>
              {montantTotal > 0 && (
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-muted">Valeur totale (px achat)</span>
                  <span className="font-mono font-bold">{fmt(montantTotal)} F</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading || !canSubmit}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Enregistrement..." : `✓ Valider (${lignes.length} produit${lignes.length > 1 ? "s" : ""})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Composant ligne produit ───────────────────────────────────────────────────
interface LigneRowProps {
  ligne:       LigneUI;
  idx:         number;
  allProduits: Produit[];
  stockMap:    Record<string, number>;
  showStock:   boolean;
  canRemove:   boolean;
  onUpdate:    (patch: Partial<LigneUI>) => void;
  onSelect:    (p: Produit) => void;
  onClear:     () => void;
  onRemove:    () => void;
}

function LigneRow({ ligne, idx, allProduits, stockMap, showStock, canRemove, onUpdate, onSelect, onClear, onRemove }: LigneRowProps) {
  const filtered = ligne.search
    ? allProduits.filter(p =>
        p.nom.toLowerCase().includes(ligne.search.toLowerCase()) ||
        p.reference.toLowerCase().includes(ligne.search.toLowerCase())
      ).slice(0, 10)
    : [];

  const stockDispo      = showStock && ligne.produitId ? (stockMap[ligne.produitId] ?? 0) : null;
  const insuffisant     = stockDispo !== null && stockDispo < ligne.quantite;

  return (
    <div className={clsx(
      "rounded-xl border p-3 space-y-2.5 transition-colors",
      insuffisant ? "border-danger/40 bg-danger/5" : "border-border bg-surface2/40"
    )}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted w-5 shrink-0">#{idx + 1}</span>

        {/* Produit sélectionné ou recherche */}
        <div className="flex-1 relative">
          {ligne.produit ? (
            <div className="flex items-center justify-between bg-surface2 border border-border2 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-bold">{ligne.produit.nom}</p>
                <p className="text-[10px] font-mono text-muted">
                  {ligne.produit.reference} · {ligne.produit.unite} · {fmt(ligne.produit.prixAchat)} F/u
                </p>
              </div>
              <button type="button" onClick={onClear}
                className="text-muted hover:text-danger ml-2 text-base shrink-0">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input
                className="input w-full"
                placeholder="🔍 Rechercher un produit..."
                value={ligne.search}
                onChange={e => onUpdate({ search: e.target.value })}
                autoComplete="off"
              />
              {filtered.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface2 border border-border
                                rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                  {filtered.map(p => (
                    <button key={p._id} type="button"
                      onMouseDown={() => onSelect(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface
                                 border-b border-border/50 last:border-0 text-left">
                      <div>
                        <p className="text-sm font-semibold">{p.nom}</p>
                        <p className="text-[10px] font-mono text-muted">{p.reference}</p>
                      </div>
                      <span className="text-xs font-mono text-muted ml-2 shrink-0">{p.unite}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quantité */}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => onUpdate({ quantite: Math.max(0.001, ligne.quantite - 1) })}
            className="btn-ghost w-8 h-8 justify-center text-lg shrink-0">−</button>
          <input type="number" min={0.001} step="any"
            className="input w-20 text-center font-bold font-mono text-sm"
            value={ligne.quantite}
            onChange={e => onUpdate({ quantite: Math.max(0.001, +e.target.value) })} />
          <button type="button" onClick={() => onUpdate({ quantite: ligne.quantite + 1 })}
            className="btn-ghost w-8 h-8 justify-center text-lg shrink-0">+</button>
        </div>

        {/* Supprimer ligne */}
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="text-muted hover:text-danger text-lg shrink-0 ml-1">🗑</button>
        )}
      </div>

      {/* Stock + montant ligne */}
      <div className="flex items-center justify-between px-1">
        {stockDispo !== null ? (
          <span className={clsx("text-[11px] font-mono",
            insuffisant ? "text-danger font-bold" : "text-success")}>
            {insuffisant ? "⚠ " : "✓ "}Stock dispo : {fmt(stockDispo)} {ligne.produit?.unite}
            {insuffisant && ` — INSUFFISANT`}
          </span>
        ) : <span />}
        {ligne.produit && ligne.produit.prixAchat > 0 && (
          <span className="text-[11px] font-mono text-muted">
            {fmt(ligne.quantite * ligne.produit.prixAchat)} F
          </span>
        )}
      </div>
    </div>
  );
}
