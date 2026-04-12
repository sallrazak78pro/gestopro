// app/reset-password/page.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const params  = useSearchParams();
  const router  = useRouter();
  const token   = params.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!token) setError("Lien invalide. Demandez un nouveau lien de réinitialisation.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Mot de passe trop court (8 caractères min)."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }

    setLoading(true); setError("");
    const res  = await fetch("/api/auth/forgot-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.success) setDone(true);
    else setError(json.message || "Une erreur est survenue.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center text-lg font-extrabold text-white">G</div>
          <div>
            <div className="font-extrabold text-lg">GestoPro</div>
            <div className="text-[10px] font-mono text-muted tracking-widest uppercase">Nouveau mot de passe</div>
          </div>
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="text-xl font-extrabold" style={{ color: "var(--color-fg)" }}>Mot de passe modifié !</h2>
              <p className="text-sm text-muted">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
              <button onClick={() => router.push("/login")} className="btn-primary w-full justify-center mt-2">
                Se connecter →
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-fg)" }}>Nouveau mot de passe</h2>
              <p className="text-sm text-muted mb-6">Choisissez un mot de passe sécurisé d'au moins 8 caractères.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nouveau mot de passe</label>
                  <div className="relative">
                    <input type={showPwd ? "text" : "password"} className="input pr-10"
                      placeholder="8 caractères minimum"
                      value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg text-sm">
                      {showPwd ? "🙈" : "👁"}
                    </button>
                  </div>
                  {/* Indicateur de force */}
                  {password.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{
                          background: password.length >= i * 3
                            ? i <= 1 ? "#ef4444" : i <= 2 ? "#f59e0b" : i <= 3 ? "#00d4ff" : "#10b981"
                            : "var(--color-border2)"
                        }} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Confirmer le mot de passe</label>
                  <input type={showPwd ? "text" : "password"} className="input"
                    placeholder="Répétez le mot de passe"
                    value={confirm} onChange={e => setConfirm(e.target.value)} required />
                  {confirm && password !== confirm && (
                    <p className="text-xs text-danger mt-1">⚠ Les mots de passe ne correspondent pas</p>
                  )}
                </div>

                {error && (
                  <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">⚠ {error}</div>
                )}

                <button type="submit" disabled={loading || !token}
                  className="btn-primary w-full justify-center disabled:opacity-60">
                  {loading ? "Modification..." : "Confirmer le nouveau mot de passe"}
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
