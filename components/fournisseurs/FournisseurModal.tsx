// components/fournisseurs/FournisseurModal.tsx
"use client";
import React from "react";
import { useState } from "react";

interface Props {
  fournisseur?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function FournisseurModal({ fournisseur, onClose, onSaved }: Props) {
  const isEdit = !!fournisseur;
  const [form, setForm] = useState({
    nom:       fournisseur?.nom       || "",
    contact:   fournisseur?.contact   || "",
    telephone: fournisseur?.telephone || "",
    email:     fournisseur?.email     || "",
    adresse:   fournisseur?.adresse   || "",
    ville:     fournisseur?.ville     || "",
    pays:      fournisseur?.pays      || "",
    notes:     fournisseur?.notes     || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res  = await fetch(
      isEdit ? `/api/fournisseurs/${fournisseur._id}` : "/api/fournisseurs",
      { method: isEdit ? "PUT" : "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(form) }
    );
    const json = await res.json();
    setLoading(false);
    if (!json.success) { setError(json.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card p-6 animate-slide-up overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">{isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">{isEdit ? fournisseur.nom : "Ajoutez un partenaire commercial"}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Nom du fournisseur *</label>
            <input className="input" placeholder="ex: Tech Supplies CI" value={form.nom} onChange={e=>set("nom",e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Nom du contact</label>
              <input className="input" placeholder="ex: M. Kouassi" value={form.contact} onChange={e=>set("contact",e.target.value)} />
            </div>
            <div>
              <label className="input-label">Téléphone</label>
              <input className="input" placeholder="+225 07 00 00 00" value={form.telephone} onChange={e=>set("telephone",e.target.value)} />
            </div>
          </div>
          <div>
            <label className="input-label">Email</label>
            <input type="email" className="input" placeholder="contact@fournisseur.com" value={form.email} onChange={e=>set("email",e.target.value)} />
          </div>
          <div>
            <label className="input-label">Adresse</label>
            <input className="input" placeholder="Rue, quartier..." value={form.adresse} onChange={e=>set("adresse",e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Ville</label>
              <input className="input" placeholder="ex: Abidjan" value={form.ville} onChange={e=>set("ville",e.target.value)} />
            </div>
            <div>
              <label className="input-label">Pays</label>
              <input className="input" placeholder="ex: Côte d'Ivoire" value={form.pays} onChange={e=>set("pays",e.target.value)} />
            </div>
          </div>
          <div>
            <label className="input-label">Notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Conditions de paiement, délais habituels..." value={form.notes} onChange={e=>set("notes",e.target.value)} />
          </div>
          {error && <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">⚠ {error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading || !form.nom} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Enregistrement..." : isEdit ? "✓ Modifier" : "✓ Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
