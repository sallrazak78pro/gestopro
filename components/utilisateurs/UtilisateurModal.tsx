// components/utilisateurs/UtilisateurModal.tsx
"use client";
import React from "react";
import { useState } from "react";
import clsx from "clsx";

interface Boutique { _id: string; nom: string; type: string; }

interface Props {
  user?: any;           // si fourni → mode édition
  boutiques: Boutique[];
  currentRole: string;  // rôle de l'admin connecté
  onClose: () => void;
  onSaved: () => void;
}

const ROLES = [
  { value: "admin",        icon: "👑", label: "Admin",        desc: "Accès complet, peut gérer les utilisateurs", color: "border-danger/40 bg-danger/5 text-danger" },
  { value: "gestionnaire", icon: "📦", label: "Gestionnaire", desc: "Stock, mouvements, ventes",                   color: "border-accent/40 bg-accent/5 text-accent" },
  { value: "caissier",     icon: "💵", label: "Caissier",     desc: "Ventes uniquement",                           color: "border-success/40 bg-success/5 text-success" },
];

export default function UtilisateurModal({ user, boutiques, currentRole, onClose, onSaved }: Props) {
  const isEdit = !!user;

  const [form, setForm] = useState({
    nom:        user?.nom        || "",
    email:      user?.email      || "",
    password:   "",
    role:       user?.role       || "caissier",
    boutiqueId: user?.boutique?._id || "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Un admin ne peut pas créer un autre admin
  const availableRoles = currentRole === "admin"
    ? ROLES.filter(r => r.value !== "admin")
    : ROLES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    const body: any = {
      nom:       form.nom,
      email:     form.email,
      role:      form.role,
      boutiqueId: form.boutiqueId || null,
    };
    if (form.password) body.password = form.password;
    if (!isEdit) body.password = form.password; // obligatoire en création

    const res = await fetch(
      isEdit ? `/api/utilisateurs/${user._id}` : "/api/utilisateurs",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    setLoading(false);
    if (!json.success) { setError(json.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg card animate-slide-up flex flex-col max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-lg font-bold">
              {isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </h2>
            <p className="text-[11px] font-mono text-muted mt-0.5">
              {isEdit ? `Modification du compte · ${user.email}` : "Créez un accès pour un membre de votre équipe"}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Nom + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Nom complet *</label>
              <input className="input" placeholder="ex: Jean Kouassi"
                value={form.nom} onChange={e => set("nom", e.target.value)} required />
            </div>
            <div>
              <label className="input-label">Email *</label>
              <input type="email" className="input" placeholder="jean@email.com"
                value={form.email} onChange={e => set("email", e.target.value)} required />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="input-label">
              {isEdit ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe * (min. 6 caractères)"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input pr-12"
                placeholder={isEdit ? "Laisser vide pour ne pas changer" : "••••••••"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                required={!isEdit}
                minLength={isEdit ? undefined : 6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors text-sm"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
            {form.password && form.password.length < 6 && (
              <p className="text-xs font-mono text-danger mt-1">Minimum 6 caractères</p>
            )}
          </div>

          {/* Rôle */}
          <div>
            <label className="input-label">Rôle *</label>
            <div className="space-y-2">
              {availableRoles.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set("role", r.value)}
                  className={clsx(
                    "w-full flex items-center gap-4 px-4 py-3 rounded-xl border-2 text-left transition-all",
                    form.role === r.value
                      ? r.color + " shadow-sm"
                      : "border-border bg-surface2 text-muted2 hover:border-border2"
                  )}
                >
                  <span className="text-xl shrink-0">{r.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{r.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">{r.desc}</p>
                  </div>
                  <div className={clsx(
                    "w-4 h-4 rounded-full border-2 shrink-0 transition-all",
                    form.role === r.value ? "border-current bg-current" : "border-border"
                  )} />
                </button>
              ))}
            </div>
          </div>

          {/* Boutique assignée */}
          <div>
            <label className="input-label">Boutique assignée</label>
            <select className="select" value={form.boutiqueId} onChange={e => set("boutiqueId", e.target.value)}>
              <option value="">Toutes les boutiques (accès global)</option>
              {boutiques.map(b => (
                <option key={b._id} value={b._id}>{b.nom}</option>
              ))}
            </select>
            <p className="text-[10px] font-mono text-muted mt-1">
              💡 Si vous assignez une boutique, l&apos;utilisateur ne verra QUE les données de cette boutique (ventes, stock, mouvements, trésorerie).
            </p>
          </div>

          {/* Récap */}
          {form.nom && form.email && (
            <div className="bg-surface2 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Récapitulatif</p>
              {[
                { k: "Nom",      v: form.nom },
                { k: "Email",    v: form.email },
                { k: "Rôle",     v: ROLES.find(r => r.value === form.role)?.label ?? form.role },
                { k: "Boutique", v: boutiques.find(b => b._id === form.boutiqueId)?.nom ?? "Accès global" },
              ].map((row, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted">{row.k}</span>
                  <span className="font-semibold">{row.v}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !form.nom || !form.email || (!isEdit && form.password.length < 6)}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {loading
                ? "Enregistrement..."
                : isEdit ? "✓ Sauvegarder les modifications" : "✓ Créer l'utilisateur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
