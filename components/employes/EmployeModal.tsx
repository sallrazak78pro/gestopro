// components/employes/EmployeModal.tsx
"use client";
import React from "react";
import { useState } from "react";

interface Props {
  employe?: any;
  boutiques: any[];
  onClose: () => void;
  onSaved: () => void;
}

const POSTES = ["Caissier", "Gestionnaire de stock", "Livreur", "Agent de sécurité", "Vendeur", "Responsable boutique", "Comptable", "Agent de nettoyage", "Autre"];

export default function EmployeModal({ employe, boutiques, onClose, onSaved }: Props) {
  const isEdit = !!employe;
  const [form, setForm] = useState({
    nom:          employe?.nom          || "",
    prenom:       employe?.prenom       || "",
    telephone:    employe?.telephone    || "",
    adresse:      employe?.adresse      || "",
    cni:          employe?.cni          || "",
    poste:        employe?.poste        || "",
    posteSaisie:  "",
    boutique:     employe?.boutique?._id || employe?.boutique || "",
    dateEmbauche: employe?.dateEmbauche
      ? new Date(employe.dateEmbauche).toISOString().split("T")[0]
      : "",
    salaireBase:  employe?.salaireBase  || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Gestion poste personnalisé
  const posteEffectif = form.poste === "__autre__" ? form.posteSaisie : form.poste;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!posteEffectif.trim()) { setError("Le poste est requis."); return; }
    setError(""); setLoading(true);
    const payload = { ...form, poste: posteEffectif };
    const res  = await fetch(
      isEdit ? `/api/employes/${employe._id}` : "/api/employes",
      { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    const json = await res.json();
    setLoading(false);
    if (!json.success) { setError(json.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card animate-slide-up flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold">{isEdit ? "Modifier l'employé" : "Nouvel employé"}</h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {isEdit ? `${employe.prenom} ${employe.nom}` : "Renseignez les informations de l'employé"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* Nom + Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Prénom *</label>
              <input className="input" placeholder="ex: Jean"
                value={form.prenom} onChange={e => set("prenom", e.target.value)} required />
            </div>
            <div>
              <label className="input-label">Nom *</label>
              <input className="input" placeholder="ex: Kouassi"
                value={form.nom} onChange={e => set("nom", e.target.value)} required />
            </div>
          </div>

          {/* Téléphone + CNI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Téléphone</label>
              <input className="input" placeholder="+225 07 00 00 00"
                value={form.telephone} onChange={e => set("telephone", e.target.value)} />
            </div>
            <div>
              <label className="input-label">N° CNI / Pièce</label>
              <input className="input" placeholder="CI-0000-0000"
                value={form.cni} onChange={e => set("cni", e.target.value)} />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="input-label">Adresse</label>
            <input className="input" placeholder="Quartier, ville..."
              value={form.adresse} onChange={e => set("adresse", e.target.value)} />
          </div>

          {/* Poste */}
          <div>
            <label className="input-label">Poste / Fonction *</label>
            <select className="select" value={form.poste} onChange={e => set("poste", e.target.value)} required>
              <option value="">Choisir un poste...</option>
              {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__autre__">✏️ Saisir un poste personnalisé</option>
            </select>
            {form.poste === "__autre__" && (
              <input className="input mt-2" placeholder="Saisir le poste..."
                value={form.posteSaisie} onChange={e => set("posteSaisie", e.target.value)} required />
            )}
          </div>

          {/* Boutique */}
          <div>
            <label className="input-label">Boutique *</label>
            <select className="select" value={form.boutique} onChange={e => set("boutique", e.target.value)} required>
              <option value="">Choisir une boutique...</option>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
          </div>

          {/* Date embauche + Salaire */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Date d'embauche *</label>
              <input type="date" className="input"
                value={form.dateEmbauche} onChange={e => set("dateEmbauche", e.target.value)} required />
            </div>
            <div>
              <label className="input-label">Salaire de base (F) *</label>
              <input type="number" min={0} step="1" className="input" placeholder="ex: 150000"
                value={form.salaireBase} onChange={e => set("salaireBase", +e.target.value)} required />
            </div>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Enregistrement..." : isEdit ? "✓ Modifier" : "✓ Créer l'employé"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
