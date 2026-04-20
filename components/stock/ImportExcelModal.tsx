// components/stock/ImportExcelModal.tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────
interface CatalogItem { _id: string; valeur: string; icone: string; }

interface ProductRow {
  selected: boolean;
  form: {
    reference: string;
    nom: string;
    description: string;
    categorie: string;
    unite: string;
    prixAchat: string;
    prixVente: string;
    seuilAlerte: string;
  };
}

interface ImportResult {
  nom: string;
  success: boolean;
  message?: string;
}

type Step = "upload" | "mapping" | "review" | "importing" | "done";

const FIELDS = [
  { key: "nom",         label: "Nom du produit",  required: true  },
  { key: "reference",   label: "Référence",        required: false },
  { key: "categorie",   label: "Catégorie",        required: true  },
  { key: "unite",       label: "Unité",            required: true  },
  { key: "prixAchat",   label: "Prix d'achat",     required: false },
  { key: "prixVente",   label: "Prix de vente",    required: true  },
  { key: "seuilAlerte", label: "Seuil d'alerte",   required: false },
  { key: "description", label: "Description",      required: false },
] as const;

type FieldKey = typeof FIELDS[number]["key"];

// ── Props ──────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onSaved: () => void;
}

// ── ChipSelector (inline, same style as ProduitModal) ─────────
function ChipSelector({ label, items, selected, onSelect, onAdd, required }: {
  label: string; items: CatalogItem[]; selected: string;
  onSelect: (v: string) => void;
  onAdd: (v: string) => Promise<void>;
  required?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 8);

  async function handleAdd() {
    if (!newVal.trim() || adding) return;
    setAdding(true);
    await onAdd(newVal.trim());
    setNewVal("");
    setAdding(false);
  }

  return (
    <div>
      <label className="input-label">{label}{required && " *"}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {visible.map(item => (
          <button key={item._id} type="button"
            onClick={() => onSelect(item.valeur)}
            className={clsx(
              "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
              selected === item.valeur
                ? "bg-accent/15 text-accent border-accent/40"
                : "bg-surface2 text-muted2 border-border hover:border-border2 hover:text-white"
            )}>
            {item.icone && <span className="mr-1">{item.icone}</span>}
            {item.valeur}
            {selected === item.valeur && <span className="ml-1 text-accent">✓</span>}
          </button>
        ))}
        {items.length > 8 && (
          <button type="button" onClick={() => setShowAll(!showAll)}
            className="px-2.5 py-1 rounded-lg text-xs border border-dashed border-border text-muted hover:text-white">
            {showAll ? "Moins" : `+${items.length - 8}`}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1 text-xs py-1.5" placeholder={`Nouvelle ${label.toLowerCase()}...`}
          value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }} />
        <button type="button" disabled={adding || !newVal.trim()}
          onClick={handleAdd}
          className="btn-primary btn-sm px-3 disabled:opacity-50 shrink-0 text-xs">
          {adding ? "..." : "+ Ajouter"}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function ImportExcelModal({ onClose, onSaved }: Props) {
  const [step, setStep]           = useState<Step>("upload");
  const [rawRows, setRawRows]     = useState<Record<string, string>[]>([]);
  const [columns, setColumns]     = useState<string[]>([]);
  const [mapping, setMapping]     = useState<Partial<Record<FieldKey, string>>>({});
  const [products, setProducts]   = useState<ProductRow[]>([]);
  const [current, setCurrent]     = useState(0);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [unites, setUnites]         = useState<CatalogItem[]>([]);
  const [results, setResults]       = useState<ImportResult[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [dragOver, setDragOver]   = useState(false);
  const [parseError, setParseError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load categories & units once
  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then(r => r.json()),
      fetch("/api/unites").then(r => r.json()),
    ]).then(([cats, units]) => {
      if (cats.success)  setCategories(cats.data);
      if (units.success) setUnites(units.data);
    });
  }, []);

  // ── Parse file ───────────────────────────────────────────────
  async function parseFile(file: File) {
    setParseError("");
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError("Format non supporté. Utilisez .xlsx, .xls ou .csv");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      if (!data.length) { setParseError("Le fichier est vide."); return; }
      const cols = Object.keys(data[0]);
      setRawRows(data);
      setColumns(cols);
      // Auto-detect mapping by column name similarity
      const autoMap: Partial<Record<FieldKey, string>> = {};
      for (const field of FIELDS) {
        const match = cols.find(c =>
          c.toLowerCase().replace(/[^a-z]/g, "").includes(
            field.key.toLowerCase().replace(/[^a-z]/g, "")
          ) || c.toLowerCase().includes(field.label.toLowerCase().split(" ")[0])
        );
        if (match) autoMap[field.key] = match;
      }
      setMapping(autoMap);
      setStep("mapping");
    } catch {
      setParseError("Erreur lors de la lecture du fichier. Vérifiez qu'il n'est pas corrompu.");
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  // ── Apply mapping → build product rows ───────────────────────
  function applyMapping() {
    const rows: ProductRow[] = rawRows.map(row => ({
      selected: true,
      form: {
        reference:   mapping.reference   ? String(row[mapping.reference]   || "") : "",
        nom:         mapping.nom         ? String(row[mapping.nom]         || "") : "",
        description: mapping.description ? String(row[mapping.description] || "") : "",
        categorie:   mapping.categorie   ? String(row[mapping.categorie]   || "") : "",
        unite:       mapping.unite       ? String(row[mapping.unite]       || "") : "",
        prixAchat:   mapping.prixAchat   ? String(row[mapping.prixAchat]   || "0") : "0",
        prixVente:   mapping.prixVente   ? String(row[mapping.prixVente]   || "0") : "0",
        seuilAlerte: mapping.seuilAlerte ? String(row[mapping.seuilAlerte] || "5") : "5",
      },
    }));
    setProducts(rows);
    setCurrent(0);
    setStep("review");
  }

  // ── Update a field in current product ────────────────────────
  const setField = useCallback((key: keyof ProductRow["form"], value: string) => {
    setProducts(prev => prev.map((p, i) =>
      i === current ? { ...p, form: { ...p.form, [key]: value } } : p
    ));
  }, [current]);

  const toggleSelected = useCallback(() => {
    setProducts(prev => prev.map((p, i) =>
      i === current ? { ...p, selected: !p.selected } : p
    ));
  }, [current]);

  // ── Catalog helpers ───────────────────────────────────────────
  async function addCategorie(valeur: string) {
    const res = await fetch("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valeur }),
    });
    const json = await res.json();
    if (json.success) {
      setCategories(prev => [...prev, json.data].sort((a, b) => a.valeur.localeCompare(b.valeur)));
      setField("categorie", json.data.valeur);
    }
  }

  async function addUnite(valeur: string) {
    const res = await fetch("/api/unites", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valeur }),
    });
    const json = await res.json();
    if (json.success) {
      setUnites(prev => [...prev, json.data].sort((a, b) => a.valeur.localeCompare(b.valeur)));
      setField("unite", json.data.valeur);
    }
  }

  // ── Import all selected products ──────────────────────────────
  async function runImport() {
    setStep("importing");
    const toImport = products.filter(p => p.selected);
    const res: ImportResult[] = [];
    for (let i = 0; i < toImport.length; i++) {
      const p = toImport[i];
      try {
        const r = await fetch("/api/produits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...p.form,
            prixAchat:   parseFloat(p.form.prixAchat)   || 0,
            prixVente:   parseFloat(p.form.prixVente)   || 0,
            seuilAlerte: parseFloat(p.form.seuilAlerte) || 5,
          }),
        });
        const json = await r.json();
        res.push({ nom: p.form.nom || `Produit ${i + 1}`, success: json.success, message: json.message });
      } catch {
        res.push({ nom: p.form.nom || `Produit ${i + 1}`, success: false, message: "Erreur réseau" });
      }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }
    setResults(res);
    setStep("done");
  }

  // Validation current product
  const p = products[current];
  const currentErrors = p ? [
    !p.form.nom      && "Nom requis",
    !p.form.categorie && "Catégorie requise",
    !p.form.unite     && "Unité requise",
    !p.form.prixVente && "Prix de vente requis",
  ].filter(Boolean) as string[] : [];

  const selectedCount = products.filter(p => p.selected).length;
  const marge    = parseFloat(p?.form.prixVente || "0") - parseFloat(p?.form.prixAchat || "0");
  const margePct = parseFloat(p?.form.prixAchat || "0") > 0
    ? ((marge / parseFloat(p.form.prixAchat)) * 100).toFixed(1) : "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl card animate-slide-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold">Import depuis Excel</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {step === "upload"    && "Sélectionnez un fichier .xlsx, .xls ou .csv"}
              {step === "mapping"   && `${rawRows.length} ligne${rawRows.length > 1 ? "s" : ""} détectée${rawRows.length > 1 ? "s" : ""} — associez les colonnes`}
              {step === "review"    && `Revue produit ${current + 1}/${products.length} · ${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""}`}
              {step === "importing" && `Import en cours... ${importProgress}%`}
              {step === "done"      && `Import terminé · ${results.filter(r => r.success).length}/${results.length} réussi${results.filter(r => r.success).length > 1 ? "s" : ""}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 py-3 gap-2 border-b border-border shrink-0">
          {(["upload", "mapping", "review", "done"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-border" />}
              <div className={clsx(
                "flex items-center gap-1.5 text-xs font-mono",
                step === s ? "text-accent" : ["upload","mapping","review","done"].indexOf(step) > i ? "text-success" : "text-muted"
              )}>
                <span className={clsx(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border",
                  step === s ? "bg-accent/15 border-accent text-accent"
                  : ["upload","mapping","review","done"].indexOf(step) > i ? "bg-success/15 border-success text-success"
                  : "border-border"
                )}>
                  {["upload","mapping","review","done"].indexOf(step) > i ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline capitalize">
                  {s === "upload" ? "Fichier" : s === "mapping" ? "Colonnes" : s === "review" ? "Revue" : "Résultat"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">

          {/* ── STEP 1: Upload ──────────────────────────────── */}
          {step === "upload" && (
            <div className="p-6 space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
                  dragOver ? "border-accent bg-accent/10" : "border-border hover:border-border2 hover:bg-surface2"
                )}>
                <div className="text-4xl mb-3">📊</div>
                <p className="font-semibold text-sm">Glisser-déposer votre fichier ici</p>
                <p className="text-xs text-muted mt-1">ou cliquer pour sélectionner</p>
                <p className="text-[10px] font-mono text-muted2 mt-3">.xlsx · .xls · .csv</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />

              {parseError && (
                <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                  ⚠ {parseError}
                </div>
              )}

              {/* Template download hint */}
              <div className="bg-surface2 border border-border rounded-xl p-4 text-xs font-mono text-muted space-y-1">
                <p className="text-white font-semibold text-[11px] mb-2">Colonnes suggérées dans votre fichier :</p>
                {FIELDS.map(f => (
                  <p key={f.key}>
                    <span className={f.required ? "text-accent" : "text-muted2"}>
                      {f.required ? "● " : "○ "}
                    </span>
                    {f.label}{f.required ? " (requis)" : " (optionnel)"}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Mapping ─────────────────────────────── */}
          {step === "mapping" && (
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted">
                Associez chaque champ produit à la colonne correspondante dans votre fichier.
              </p>
              <div className="space-y-3">
                {FIELDS.map(field => (
                  <div key={field.key} className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <span className="text-sm font-semibold">{field.label}</span>
                      {field.required && <span className="text-accent text-xs ml-1">*</span>}
                    </div>
                    <select
                      className="select text-sm"
                      value={mapping[field.key] || ""}
                      onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value || undefined }))}
                    >
                      <option value="">— Ignorer —</option>
                      {columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview first row */}
              {rawRows[0] && (
                <div className="bg-surface2 border border-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Aperçu · 1re ligne</p>
                  <div className="space-y-1">
                    {FIELDS.filter(f => mapping[f.key]).map(f => (
                      <p key={f.key} className="text-xs font-mono">
                        <span className="text-muted">{f.label} → </span>
                        <span className="text-white">{String(rawRows[0][mapping[f.key]!] || "—")}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Review ──────────────────────────────── */}
          {step === "review" && p && (
            <div className="p-6 space-y-4">
              {/* Product nav bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1 flex-wrap flex-1">
                  {products.map((prod, i) => (
                    <button key={i} type="button"
                      onClick={() => setCurrent(i)}
                      className={clsx(
                        "w-7 h-7 rounded-lg text-[10px] font-mono font-bold border transition-all",
                        i === current ? "bg-accent text-black border-accent"
                        : prod.selected ? "bg-success/15 text-success border-success/30"
                        : "bg-surface2 text-muted border-border line-through"
                      )}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-mono text-muted shrink-0">
                  {selectedCount}/{products.length}
                </span>
              </div>

              {/* Include/skip toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface2">
                <div>
                  <p className="text-sm font-semibold">
                    {p.form.nom || `Produit ${current + 1}`}
                  </p>
                  <p className="text-[10px] font-mono text-muted mt-0.5">
                    {p.selected ? "Sera importé" : "Ignoré"}
                  </p>
                </div>
                <button type="button" onClick={toggleSelected}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    p.selected
                      ? "bg-success/15 text-success border-success/30 hover:bg-danger/15 hover:text-danger hover:border-danger/30"
                      : "bg-surface text-muted border-border hover:bg-success/15 hover:text-success hover:border-success/30"
                  )}>
                  {p.selected ? "✓ Sélectionné" : "○ Ignoré"}
                </button>
              </div>

              {p.selected && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Référence</label>
                      <input className="input" placeholder="Auto si vide"
                        value={p.form.reference}
                        onChange={e => setField("reference", e.target.value)} />
                    </div>
                    <div>
                      <label className="input-label">Seuil d'alerte</label>
                      <input type="number" min={0} className="input"
                        value={p.form.seuilAlerte}
                        onChange={e => setField("seuilAlerte", e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Nom du produit *</label>
                    <input className="input" placeholder="Nom requis"
                      value={p.form.nom}
                      onChange={e => setField("nom", e.target.value)} />
                  </div>

                  <div>
                    <label className="input-label">Description</label>
                    <textarea className="input resize-none" rows={2} placeholder="Optionnel..."
                      value={p.form.description}
                      onChange={e => setField("description", e.target.value)} />
                  </div>

                  <div className="border-t border-border" />

                  <ChipSelector label="Catégorie" required
                    items={categories} selected={p.form.categorie}
                    onSelect={v => setField("categorie", v)}
                    onAdd={addCategorie} />

                  <ChipSelector label="Unité de mesure" required
                    items={unites} selected={p.form.unite}
                    onSelect={v => setField("unite", v)}
                    onAdd={addUnite} />

                  <div className="border-t border-border" />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Prix d'achat (F)</label>
                      <input type="number" min={0} step="1" className="input" placeholder="0"
                        value={p.form.prixAchat}
                        onChange={e => setField("prixAchat", e.target.value)} />
                    </div>
                    <div>
                      <label className="input-label">Prix de vente (F) *</label>
                      <input type="number" min={0} step="1" className="input" placeholder="0"
                        value={p.form.prixVente}
                        onChange={e => setField("prixVente", e.target.value)} />
                    </div>
                  </div>

                  {parseFloat(p.form.prixAchat) > 0 && parseFloat(p.form.prixVente) > 0 && (
                    <div className={clsx(
                      "flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs",
                      marge >= 0 ? "bg-success/10 border-success/20 text-success" : "bg-danger/10 border-danger/20 text-danger"
                    )}>
                      <span className="font-mono">Marge brute</span>
                      <span className="font-bold font-mono">
                        {marge >= 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(marge)} F ({margePct}%)
                      </span>
                    </div>
                  )}

                  {currentErrors.length > 0 && (
                    <div className="bg-danger/10 border border-danger/30 text-danger text-xs px-3 py-2 rounded-xl space-y-0.5">
                      {currentErrors.map(e => <p key={e}>⚠ {e}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Importing ───────────────────────────── */}
          {step === "importing" && (
            <div className="p-12 flex flex-col items-center gap-6">
              <div className="text-4xl animate-bounce">📦</div>
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs font-mono text-muted mb-2">
                  <span>Import en cours...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-surface2 rounded-full h-2 border border-border">
                  <div className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Done ────────────────────────────────── */}
          {step === "done" && (
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold font-mono text-success">
                    {results.filter(r => r.success).length}
                  </p>
                  <p className="text-xs font-mono text-muted mt-1">Importés</p>
                </div>
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold font-mono text-danger">
                    {results.filter(r => !r.success).length}
                  </p>
                  <p className="text-xs font-mono text-muted mt-1">Échecs</p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs border",
                    r.success
                      ? "bg-success/5 border-success/20 text-success"
                      : "bg-danger/5 border-danger/20 text-danger"
                  )}>
                    <span>{r.success ? "✓" : "✕"}</span>
                    <span className="flex-1 font-semibold truncate">{r.nom}</span>
                    {!r.success && <span className="text-muted font-mono shrink-0">{r.message}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0 bg-surface sticky bottom-0">
          {step === "upload" && (
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
              Annuler
            </button>
          )}

          {step === "mapping" && (
            <>
              <button type="button" onClick={() => setStep("upload")} className="btn-ghost flex-1 justify-center">
                ← Retour
              </button>
              <button type="button"
                disabled={!FIELDS.filter(f => f.required).every(f => mapping[f.key])}
                onClick={applyMapping}
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                Continuer →
              </button>
            </>
          )}

          {step === "review" && (
            <>
              <div className="flex gap-2 flex-1">
                <button type="button"
                  disabled={current === 0}
                  onClick={() => setCurrent(c => c - 1)}
                  className="btn-ghost btn-sm px-4 disabled:opacity-30">
                  ← Préc.
                </button>
                {current < products.length - 1 ? (
                  <button type="button"
                    onClick={() => setCurrent(c => c + 1)}
                    className="btn-primary btn-sm flex-1 justify-center">
                    Suivant →
                  </button>
                ) : (
                  <button type="button"
                    disabled={selectedCount === 0}
                    onClick={runImport}
                    className="btn-primary btn-sm flex-1 justify-center disabled:opacity-50">
                    ✓ Importer {selectedCount} produit{selectedCount > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </>
          )}

          {step === "done" && (
            <button type="button"
              onClick={() => { onSaved(); }}
              className="btn-primary flex-1 justify-center">
              ✓ Terminer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
