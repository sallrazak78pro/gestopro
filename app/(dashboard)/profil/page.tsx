// app/(dashboard)/profil/page.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

const ROLE_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  superadmin:   { label: "Super Admin",  icon: "⚡", color: "badge-blue"   },
  admin:        { label: "Admin",        icon: "👑", color: "badge-purple" },
  gestionnaire: { label: "Gestionnaire", icon: "📊", color: "badge-green"  },
  caissier:     { label: "Caissier",     icon: "🏧", color: "badge-orange" },
};

export default function ProfilPage() {
  const { data: session, update } = useSession();
  const user = session?.user as any;

  const [nom,        setNom]       = useState("");
  const [prenom,     setPrenom]    = useState("");
  const [telephone,  setTelephone] = useState("");
  const [saving,     setSaving]    = useState(false);
  const [pwdForm,    setPwdForm]   = useState({ current: "", nouveau: "", confirm: "" });
  const [pwdSaving,  setPwdSaving] = useState(false);
  const [msg,        setMsg]       = useState<{ type: "ok"|"err"; text: string } | null>(null);
  const [pwdMsg,     setPwdMsg]    = useState<{ type: "ok"|"err"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      const parts = (user.name ?? "").split(" ");
      setPrenom(parts[0] ?? "");
      setNom(parts.slice(1).join(" ") ?? "");
      setTelephone(user.telephone ?? "");
    }
  }, [user?.name]);

  async function saveProfil(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setSaving(true);
    const res  = await fetch("/api/parametres/profil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, prenom, telephone }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setMsg({ type: "ok", text: "Profil mis à jour." });
      await update({ name: `${prenom} ${nom}` });
    } else {
      setMsg({ type: "err", text: json.message });
    }
  }

  async function savePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (pwdForm.nouveau !== pwdForm.confirm) {
      setPwdMsg({ type: "err", text: "Les mots de passe ne correspondent pas." }); return;
    }
    if (pwdForm.nouveau.length < 6) {
      setPwdMsg({ type: "err", text: "Minimum 6 caractères." }); return;
    }
    setPwdSaving(true);
    const res  = await fetch("/api/parametres/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.nouveau }),
    });
    const json = await res.json();
    setPwdSaving(false);
    if (json.success) {
      setPwdMsg({ type: "ok", text: "Mot de passe modifié." });
      setPwdForm({ current: "", nouveau: "", confirm: "" });
    } else {
      setPwdMsg({ type: "err", text: json.message });
    }
  }

  const roleInfo = ROLE_LABEL[user?.role] ?? { label: user?.role, icon: "👤", color: "badge-orange" };

  return (
    <div className="max-w-2xl space-y-5">
      {/* En-tête profil */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          {/* Avatar initiales */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)" }}>
            {(user?.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold truncate" style={{ color: "var(--color-fg)" }}>
              {user?.name ?? "—"}
            </h1>
            <p className="text-sm font-mono text-muted truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={roleInfo.color}>{roleInfo.icon} {roleInfo.label}</span>
              {user?.boutique && (
                <span className="badge-blue text-[11px]">📍 Boutique assignée</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">👤 Informations personnelles</h2>
        </div>
        <form onSubmit={saveProfil} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Prénom</label>
              <input className="input" value={prenom}
                onChange={e => setPrenom(e.target.value)} required />
            </div>
            <div>
              <label className="input-label">Nom</label>
              <input className="input" value={nom}
                onChange={e => setNom(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="input-label">Téléphone (optionnel)</label>
            <input className="input" value={telephone} placeholder="+225 07 ..."
              onChange={e => setTelephone(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input className="input opacity-60 cursor-not-allowed" value={user?.email ?? ""} readOnly disabled />
            <p className="text-[10px] font-mono text-muted mt-1">L'email ne peut pas être modifié.</p>
          </div>

          {msg && (
            <div className={clsx("px-4 py-3 rounded-xl text-sm",
              msg.type === "ok" ? "bg-success/10 border border-success/30 text-success" : "bg-danger/10 border border-danger/30 text-danger")}>
              {msg.type === "ok" ? "✅" : "⚠"} {msg.text}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? "Enregistrement..." : "💾 Enregistrer"}
          </button>
        </form>
      </div>

      {/* Changer mot de passe */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🔒 Changer le mot de passe</h2>
        </div>
        <form onSubmit={savePwd} className="p-6 space-y-4">
          <div>
            <label className="input-label">Mot de passe actuel</label>
            <input type="password" className="input" value={pwdForm.current}
              onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} required />
          </div>
          <div>
            <label className="input-label">Nouveau mot de passe</label>
            <input type="password" className="input" value={pwdForm.nouveau} placeholder="6 caractères minimum"
              onChange={e => setPwdForm(f => ({ ...f, nouveau: e.target.value }))} required />
          </div>
          <div>
            <label className="input-label">Confirmer le nouveau mot de passe</label>
            <input type="password" className="input" value={pwdForm.confirm}
              onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>

          {pwdMsg && (
            <div className={clsx("px-4 py-3 rounded-xl text-sm",
              pwdMsg.type === "ok" ? "bg-success/10 border border-success/30 text-success" : "bg-danger/10 border border-danger/30 text-danger")}>
              {pwdMsg.type === "ok" ? "✅" : "⚠"} {pwdMsg.text}
            </div>
          )}

          <button type="submit" disabled={pwdSaving} className="btn-primary disabled:opacity-60">
            {pwdSaving ? "Modification..." : "🔑 Changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
