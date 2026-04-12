// components/stock/ProduitModal.tsx
"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

interface Props {
  produit?: any;
  onClose: () => void;
  onSaved: () => void;
}
interface CatalogItem { _id: string; valeur: string; icone: string; }

// ── Création inline — PAS de <form> imbriqué ──────────────────
// On utilise un <div> + onKeyDown pour éviter de soumettre le formulaire parent
function InlineCreate({ placeholder, onAdd, loading }: {
  placeholder: string;
  onAdd: (val: string) => Promise<void>;
  loading: boolean;
}) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    if (!val.trim() || loading) return;
    await onAdd(val.trim());
    setVal("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex gap-2 mt-2">
      <input
        ref={inputRef}
        className="input flex-1 text-sm py-2"
        placeholder={placeholder}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault(); // ← empêche la soumission du formulaire parent
            e.stopPropagation();
            handleAdd();
          }
        }}
      />
      <button
        type="button" // ← CRUCIAL : ne pas être type="submit"
        disabled={loading || !val.trim()}
        onClick={handleAdd}
        className="btn-primary btn-sm px-3 disabled:opacity-50 shrink-0"
      >
        {loading ? "..." : "+ Ajouter"}
      </button>
    </div>
  );
}

// ── Sélecteur chips ───────────────────────────────────────────
function ChipSelector({ label, items, selected, onSelect, onAdd, onDelete, addPlaceholder, required }: {
  label: string; items: CatalogItem[]; selected: string;
  onSelect: (v: string) => void;
  onAdd: (v: string) => Promise<void>;
  onDelete: (id: string) => void;
  addPlaceholder: string; required?: boolean;
}) {
  const [adding, setAdding]   = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 9);

  async function handleAdd(val: string) {
    setAdding(true);
    await onAdd(val);
    setAdding(false);
  }

  return (
    <div>
      <label className="input-label">{label}{required && " *"}</label>
      <div className="flex flex-wrap gap-2 mb-1">
        {visible.map(item => (
          <div key={item._id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(item.valeur)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                selected === item.valeur
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "bg-surface2 text-muted2 border-border hover:border-border2 hover:text-white"
              )}>
              {item.icone && <span>{item.icone}</span>}
              {item.valeur}
              {selected === item.valeur && <span className="ml-0.5 text-accent">✓</span>}
            </button>
            <button
              type="button"
              onClick={() => onDelete(item._id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white
                         text-[9px] hidden group-hover:flex items-center justify-center z-10">
              ✕
            </button>
          </div>
        ))}
        {items.length > 9 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="px-3 py-1.5 rounded-xl text-xs border border-dashed border-border text-muted hover:text-white transition-colors">
            {showAll ? "Voir moins" : `+${items.length - 9} autres`}
          </button>
        )}
      </div>
      {selected && !items.find(i => i.valeur === selected) && (
        <p className="text-xs font-mono text-accent mb-1">✓ Sélectionné : {selected}</p>
      )}
      <InlineCreate placeholder={addPlaceholder} onAdd={handleAdd} loading={adding} />
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────
export default function ProduitModal({ produit, onClose, onSaved }: Props) {
  const isEdit = !!produit;
  const [form, setForm] = useState({
    reference:   produit?.reference   || "",
    nom:         produit?.nom         || "",
    description: produit?.description || "",
    categorie:   produit?.categorie   || "",
    prixAchat:   produit?.prixAchat   || "",
    prixVente:   produit?.prixVente   || "",
    seuilAlerte: produit?.seuilAlerte ?? 5,
    unite:       produit?.unite       || "",
    image:       produit?.image       || "",
  });
  const [imagePreview, setImagePreview] = useState<string>(produit?.image || "");
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [unites, setUnites]         = useState<CatalogItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [catLoading, setCatLoading] = useState(true);
  const [error, setError]           = useState("");

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Upload image vers Cloudinary via notre API
  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) { setError("Fichier non valide. Choisissez une image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image trop grande (max 5 MB)."); return; }
    setImageLoading(true);
    setError("");

    // Aperçu local immédiat pendant l'upload
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        set("image", json.url);
        setImagePreview(json.url);
      } else {
        setError(json.message || "Erreur upload. Vérifiez la config Cloudinary.");
        setImagePreview(form.image || "");
      }
    } catch {
      setError("Erreur réseau lors de l'upload.");
      setImagePreview(form.image || "");
    }
    setImageLoading(false);
  }

  function handleImageUrl(url: string) {
    set("image", url);
    setImagePreview(url);
  }

  function removeImage() {
    set("image", "");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useEffect(() => {
    setCatLoading(true);
    Promise.all([
      fetch("/api/categories").then(r => r.json()),
      fetch("/api/unites").then(r => r.json()),
    ]).then(([cats, units]) => {
      if (cats.success)  setCategories(cats.data);
      if (units.success) setUnites(units.data);
      setCatLoading(false);
    });
  }, []);

  async function addCategorie(valeur: string) {
    const res  = await fetch("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valeur }),
    });
    const json = await res.json();
    if (json.success) {
      setCategories(prev => [...prev, json.data].sort((a, b) => a.valeur.localeCompare(b.valeur)));
      set("categorie", json.data.valeur);
    } else setError(json.message);
  }

  async function deleteCategorie(id: string) {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const removed = categories.find(c => c._id === id);
    setCategories(prev => prev.filter(c => c._id !== id));
    if (removed?.valeur === form.categorie) set("categorie", "");
  }

  async function addUnite(valeur: string) {
    const res  = await fetch("/api/unites", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valeur }),
    });
    const json = await res.json();
    if (json.success) {
      setUnites(prev => [...prev, json.data].sort((a, b) => a.valeur.localeCompare(b.valeur)));
      set("unite", json.data.valeur);
    } else setError(json.message);
  }

  async function deleteUnite(id: string) {
    await fetch(`/api/unites/${id}`, { method: "DELETE" });
    const removed = unites.find(u => u._id === id);
    setUnites(prev => prev.filter(u => u._id !== id));
    if (removed?.valeur === form.unite) set("unite", "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categorie) { setError("Sélectionne une catégorie."); return; }
    if (!form.unite)     { setError("Sélectionne une unité de mesure."); return; }
    setError(""); setLoading(true);
    const res  = await fetch(
      isEdit ? `/api/produits/${produit._id}` : "/api/produits",
      { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }
    );
    const json = await res.json();
    setLoading(false);
    if (!json.success) { setError(json.message); return; }
    onSaved();
  }

  const marge    = +form.prixVente - +form.prixAchat;
  const margePct = +form.prixAchat > 0 ? ((marge / +form.prixAchat) * 100).toFixed(1) : "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl card animate-slide-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold">{isEdit ? "Modifier le produit" : "Nouveau produit"}</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {isEdit ? `Réf : ${produit.reference}` : "Renseignez les informations du produit"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Référence</label>
                <input className="input" placeholder="Auto si vide"
                  value={form.reference} onChange={e => set("reference", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Seuil d'alerte</label>
                <input type="number" min={0} step="0.01" className="input"
                  value={form.seuilAlerte} onChange={e => set("seuilAlerte", +e.target.value)} />
                <p className="text-[10px] font-mono text-muted mt-1">Alerte si stock ≤ {form.seuilAlerte}</p>
              </div>
            </div>

            <div>
              <label className="input-label">Nom du produit *</label>
              <input className="input" placeholder="ex: Smartphone Samsung A55"
                value={form.nom} onChange={e => set("nom", e.target.value)} required />
            </div>

            <div>
              <label className="input-label">Description</label>
              <textarea className="input resize-none" rows={2} placeholder="Optionnel..."
                value={form.description} onChange={e => set("description", e.target.value)} />
            </div>

            {/* ── Image du produit ─────────────────────── */}
            <div>
              <label className="input-label">Image du produit (optionnel)</label>
              <div className="flex gap-3 items-start">
                {/* Aperçu */}
                <div className={`w-20 h-20 rounded-xl shrink-0 overflow-hidden border flex items-center justify-center text-2xl`}
                  style={{ borderColor: "var(--color-border2)", background: "var(--color-surface2)" }}>
                  {imageLoading ? (
                    <svg className="animate-spin w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : imagePreview ? (
                    <img src={imagePreview} alt="aperçu" className="w-full h-full object-cover" />
                  ) : "📦"}
                </div>

                {/* Contrôles */}
                <div className="flex-1 space-y-2">
                  {/* Upload fichier */}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-ghost btn-sm w-full justify-center">
                    📁 Choisir une image
                  </button>

                  {/* URL externe */}
                  <input type="url" className="input text-xs" placeholder="ou coller une URL (https://...)"
                    value={form.image?.startsWith("data:") ? "" : form.image}
                    onChange={e => handleImageUrl(e.target.value)} />

                  {imagePreview && (
                    <button type="button" onClick={removeImage}
                      className="text-[11px] font-mono text-danger hover:underline">
                      ✕ Supprimer l'image
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] font-mono text-muted mt-1">
                Upload : JPG/PNG/WebP max 5 MB (compressé auto à 400px) — ou coller une URL externe.
              </p>
            </div>

            <div className="border-t border-border" />

            {catLoading ? (
              <p className="text-xs font-mono text-muted animate-pulse">Chargement des catégories et unités...</p>
            ) : (
              <>
                <ChipSelector
                  label="Catégorie" required
                  items={categories} selected={form.categorie}
                  onSelect={v => set("categorie", v)}
                  onAdd={addCategorie}
                  onDelete={deleteCategorie}
                  addPlaceholder="Nouvelle catégorie (ex: Câbles, Sport...)"
                />
                <ChipSelector
                  label="Unité de mesure" required
                  items={unites} selected={form.unite}
                  onSelect={v => set("unite", v)}
                  onAdd={addUnite}
                  onDelete={deleteUnite}
                  addPlaceholder="Nouvelle unité (ex: Bouteille, Sac...)"
                />
              </>
            )}

            <div className="border-t border-border" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Prix d'achat (F) *</label>
                <input type="number" min={0} step="1" className="input" placeholder="0"
                  value={form.prixAchat} onChange={e => set("prixAchat", +e.target.value)} required />
              </div>
              <div>
                <label className="input-label">Prix de vente (F) *</label>
                <input type="number" min={0} step="1" className="input" placeholder="0"
                  value={form.prixVente} onChange={e => set("prixVente", +e.target.value)} required />
              </div>
            </div>

            {+form.prixAchat > 0 && +form.prixVente > 0 && (
              <div className={clsx(
                "flex items-center justify-between px-4 py-3 rounded-xl border",
                marge >= 0 ? "bg-success/10 border-success/20 text-success" : "bg-danger/10 border-danger/20 text-danger"
              )}>
                <div>
                  <p className="text-xs font-mono opacity-70">Marge brute</p>
                  <p className="font-extrabold font-mono">
                    {marge >= 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(marge)} F
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono opacity-70">Taux</p>
                  <p className="text-2xl font-extrabold font-mono">{margePct}%</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                ⚠ {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0 bg-surface sticky bottom-0">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading || !form.nom || !form.prixVente}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Enregistrement..." : isEdit ? "✓ Sauvegarder" : "✓ Créer le produit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
