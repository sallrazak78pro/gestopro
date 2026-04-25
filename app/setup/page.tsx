// app/setup/page.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [done,       setDone]       = useState(false);
  const [showPwd,    setShowPwd]    = useState(false);

  const [form, setForm] = useState({ nom: "", email: "", password: "", confirm: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/setup").then(r => r.json()).then(j => {
      if (!j.needsSetup) router.replace("/login");
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (form.password.length < 8) { setError("Mot de passe minimum 8 caractères."); return; }
    setSubmitting(true);
    const res  = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: form.nom, email: form.email, password: form.password }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!json.success) { setError(json.message); return; }
    setDone(true);
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted font-mono text-sm animate-pulse">Vérification...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1530 50%, #111827 100%)" }}>

      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)" }}>
            G
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">GestoPro</h1>
          <p className="text-[11px] font-mono text-slate-400 mt-1 uppercase tracking-[0.25em]">
            Configuration initiale
          </p>
        </div>

        {done ? (
          /* ── Succès ── */
          <div className="card p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-3xl mx-auto">
              ✅
            </div>
            <div>
              <h2 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-fg)" }}>
                Super Admin créé !
              </h2>
              <p className="text-sm text-muted">
                Ton compte administrateur plateforme est prêt. Tu peux maintenant te connecter.
              </p>
            </div>
            <button onClick={() => router.push("/login")} className="btn-primary w-full justify-center py-3">
              Se connecter →
            </button>
          </div>
        ) : (
          /* ── Formulaire ── */
          <div className="card p-8">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-fg)" }}>
                Créer le compte Super Admin
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                Ce compte gère uniquement la plateforme — activation des entreprises clientes, statistiques globales.
                Il n&apos;a accès à aucune donnée d&apos;entreprise.
              </p>
            </div>

            {/* Info box */}
            <div className="mb-6 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 flex gap-3">
              <span className="text-lg shrink-0">ℹ️</span>
              <div className="text-xs font-mono text-muted leading-relaxed">
                Chaque entreprise créera son propre compte admin via la page d&apos;inscription.
                Le Super Admin ne gère que les accès et abonnements.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label">Nom complet</label>
                <input className="input" placeholder="Ton nom" value={form.nom}
                  onChange={e => set("nom", e.target.value)} required />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input type="email" className="input" placeholder="admin@gestopro.com" value={form.email}
                  onChange={e => set("email", e.target.value)} required />
              </div>
              <div>
                <label className="input-label">Mot de passe</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} className="input pr-16"
                    placeholder="8 caractères minimum" value={form.password}
                    onChange={e => set("password", e.target.value)} required />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted hover:text-fg2">
                    {showPwd ? "Cacher" : "Voir"}
                  </button>
                </div>
              </div>
              <div>
                <label className="input-label">Confirmer le mot de passe</label>
                <input type="password" className="input" placeholder="Répète le mot de passe" value={form.confirm}
                  onChange={e => set("confirm", e.target.value)} required />
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="btn-primary w-full justify-center py-3.5 mt-2 disabled:opacity-60">
                {submitting ? "Création en cours..." : "🚀 Créer le Super Admin"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
