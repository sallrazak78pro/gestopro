// app/login/page.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router   = useRouter();
  const [form,     setForm]     = useState({ email: "", password: "" });
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPwd,  setShowPwd]  = useState(false);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/setup").then(r => r.json()).then(j => {
      if (j.needsSetup) router.replace("/setup");
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await signIn("credentials", {
      email: form.email, password: form.password, redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      if (res.error.includes("Trop de tentatives")) {
        setError(res.error);
      } else {
        setError("Email ou mot de passe incorrect.");
      }
    } else {
      // Récupérer la session pour connaître le rôle
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      const role    = (session?.user as any)?.role;
      const tenantId = (session?.user as any)?.tenantId;
      if (role === "superadmin" && !tenantId) router.push("/admin");
      else router.push("/dashboard");
    }
  }

  if (checking) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted font-mono text-sm">
        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Initialisation...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex overflow-hidden">

      {/* ── Panneau gauche : branding ──────────────────────── */}
      <div className="hidden lg:flex flex-col w-1/2 relative p-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1530 40%, #111827 100%)" }}>

        {/* Grille décorative */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#00d4ff 1px, transparent 1px), linear-gradient(90deg, #00d4ff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* Cercles lumineux */}
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-50px] right-[-50px] w-[350px] h-[350px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 mb-auto">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg"
            style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)", color: "#fff" }}>
            G
          </div>
          <span className="text-white font-extrabold text-xl tracking-tight">GestoPro</span>
        </div>

        {/* Citation centrale */}
        <div className="relative z-10 my-auto">
          <div className="w-12 h-1 rounded-full mb-8" style={{ background: "linear-gradient(90deg, #00d4ff, #7c3aed)" }} />
          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Gérez votre<br />
            <span style={{ background: "linear-gradient(90deg, #00d4ff, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              business
            </span>{" "}
            en temps réel
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            ERP complet pour gérer vos ventes, stocks, trésorerie et équipes — depuis n&apos;importe où.
          </p>
        </div>

        {/* Stats bottom */}
        <div className="relative z-10 grid grid-cols-3 gap-4 mt-auto">
          {[
            { val: "∞", label: "Boutiques" },
            { val: "24/7", label: "Disponible" },
            { val: "100%", label: "Sécurisé" },
          ].map((s, i) => (
            <div key={i} className="border rounded-2xl p-4 text-center"
              style={{ borderColor: "rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.04)" }}>
              <p className="text-2xl font-extrabold font-mono mb-1"
                style={{ background: "linear-gradient(90deg, #00d4ff, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.val}
              </p>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panneau droit : formulaire ─────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative"
        style={{ background: "var(--color-bg)" }}>

        {/* Glow subtil */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }} />

        <div className={`relative w-full max-w-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg"
              style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)", color: "#fff" }}>
              G
            </div>
            <div>
              <p className="font-extrabold text-lg" style={{ color: "var(--color-fg)" }}>GestoPro</p>
              <p className="text-[11px] font-mono text-muted uppercase tracking-widest">Système ERP</p>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--color-fg)" }}>Connexion</h1>
            <p className="text-sm text-muted">Bienvenue. Entrez vos identifiants.</p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">Email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm">✉️</span>
                <input type="email" className="input pl-10"
                  placeholder="vous@exemple.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  autoComplete="email" required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="input-label">Mot de passe</label>
                <a href="/forgot-password" className="text-xs text-muted hover:text-accent transition-colors">
                  Mot de passe oublié ?
                </a>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm">🔒</span>
                <input type={showPwd ? "text" : "password"} className="input pl-10 pr-12"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg2 transition-colors text-xs font-mono">
                  {showPwd ? "Cacher" : "Voir"}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-3.5 mt-2 disabled:opacity-60 text-base"
              style={{ borderRadius: "14px" }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Connexion en cours...
                </span>
              ) : "Se connecter →"}
            </button>
          </form>

          {/* Rôles */}
          <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-[10px] font-mono text-muted uppercase tracking-[0.2em] mb-3">Niveaux d&apos;accès</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: "Admin",        icon: "👑", desc: "Accès complet" },
                { role: "Gestionnaire", icon: "📊", desc: "Supervision" },
                { role: "Caissier",     icon: "🏧", desc: "Caisse & ventes" },
                { role: "Super Admin",  icon: "⚡", desc: "Plateforme" },
              ].map(r => (
                <div key={r.role} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: "var(--color-surface2)" }}>
                  <span className="text-sm">{r.icon}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-fg2)" }}>{r.role}</p>
                    <p className="text-[10px] font-mono text-muted">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[11px] font-mono text-muted mt-6">
            © {new Date().getFullYear()} GestoPro — Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
}
