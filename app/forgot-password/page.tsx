// app/forgot-password/page.tsx
"use client";
import React from "react";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res  = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.success) setSent(true);
    else setError(json.message || "Une erreur est survenue.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center text-lg font-extrabold text-white">G</div>
          <div>
            <div className="font-extrabold text-lg">GestoPro</div>
            <div className="text-[10px] font-mono text-muted tracking-widest uppercase">Récupérer l'accès</div>
          </div>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h2 className="text-xl font-extrabold" style={{ color: "var(--color-fg)" }}>Email envoyé !</h2>
              <p className="text-sm text-muted leading-relaxed">
                Si cet email est associé à un compte GestoPro, vous recevrez un lien de réinitialisation dans quelques minutes.
              </p>
              <p className="text-xs font-mono text-muted">Vérifiez aussi vos spams.</p>
              <Link href="/login" className="btn-primary w-full justify-center mt-4">
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-fg)" }}>Mot de passe oublié ?</h2>
              <p className="text-sm text-muted mb-6">Entrez votre email et nous vous enverrons un lien de réinitialisation.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" placeholder="vous@entreprise.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>

                {error && (
                  <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">⚠ {error}</div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-60">
                  {loading ? "Envoi en cours..." : "Envoyer le lien"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-xs text-muted hover:text-fg transition-colors">
                  ← Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
