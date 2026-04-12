// app/register/page.tsx
"use client";
import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "entreprise" | "compte" | "boutiques" | "done";

const PAYS = [
  { code: "CI", nom: "Côte d'Ivoire" }, { code: "SN", nom: "Sénégal" },
  { code: "ML", nom: "Mali" },          { code: "BF", nom: "Burkina Faso" },
  { code: "GN", nom: "Guinée" },        { code: "CM", nom: "Cameroun" },
  { code: "TG", nom: "Togo" },          { code: "BJ", nom: "Bénin" },
  { code: "NE", nom: "Niger" },         { code: "CD", nom: "RD Congo" },
  { code: "MA", nom: "Maroc" },         { code: "DZ", nom: "Algérie" },
  { code: "TN", nom: "Tunisie" },       { code: "FR", nom: "France" },
  { code: "AU", nom: "Autre" },
];

export default function RegisterPage() {
  const router  = useRouter();
  const [step, setStep]   = useState<Step>("entreprise");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Étape 1 — Entreprise
  const [entreprise, setEntreprise] = useState("");
  const [pays, setPays]     = useState("CI");
  const [ville, setVille]   = useState("");
  const [telephone, setTel] = useState("");

  // Étape 2 — Compte
  const [nom, setNom]           = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");

  // Étape 3 — Boutiques
  const [depotNom,    setDepotNom]    = useState("Dépôt Central");
  const [avecDepot,   setAvecDepot]   = useState(false);
  const [boutiques,   setBoutiques]   = useState(["", "", ""]);

  const addBoutique = () => setBoutiques(p => [...p, ""]);
  const removeBoutique = (i: number) => setBoutiques(p => p.filter((_, idx) => idx !== i));
  const updateBoutique = (i: number, v: string) => setBoutiques(p => p.map((b, idx) => idx === i ? v : b));

  async function handleSubmit() {
    setError(""); setLoading(true);
    const boutiquesNoms = boutiques.filter(b => b.trim());
    if (!boutiquesNoms.length) { setError("Ajoute au moins une boutique."); setLoading(false); return; }

    const res  = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entreprise, pays, ville, telephone, nom, email, password, boutiquesNoms, depotNom: avecDepot ? depotNom : null }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.success) { setError(json.message); return; }
    setStep("done");
  }

  const STEPS: Step[] = ["entreprise", "compte", "boutiques"];
  const stepIdx = STEPS.indexOf(step);

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#111827",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#f1f5f9", padding: "11px 16px",
    borderRadius: 10, fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
    transition: "border-color 0.2s",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.15em",
    marginBottom: 6, fontFamily: "var(--font-dm-mono, monospace)",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#070b14", color: "#f1f5f9",
      fontFamily: "var(--font-syne, 'Syne', sans-serif)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 16px", position: "relative",
    }}>
      {/* Glow bg */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translateX(-50%)", width: 500, height: 400, background: "radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 480, position: "relative" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #00d4ff, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#fff" }}>G</div>
              <span style={{ fontWeight: 800, fontSize: 20, color: "#f1f5f9", letterSpacing: -0.5 }}>GestoPro</span>
            </div>
          </Link>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 8, fontFamily: "var(--font-dm-mono, monospace)" }}>
            Créez votre espace de gestion gratuit
          </p>
        </div>

        {/* Progress bar */}
        {step !== "done" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 28 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {i > 0 && <div style={{ width: 32, height: 1, background: i <= stepIdx ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.1)" }} />}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, fontFamily: "var(--font-dm-mono, monospace)",
                  background: i < stepIdx ? "#10b981" : i === stepIdx ? "linear-gradient(135deg, #00d4ff, #7c3aed)" : "#111827",
                  color: i <= stepIdx ? "#fff" : "#64748b",
                  border: i > stepIdx ? "1px solid rgba(255,255,255,0.1)" : "none",
                }}>
                  {i < stepIdx ? "✓" : i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Card */}
        <div style={{ background: "#0d1424", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px" }}>

          {/* ── ÉTAPE 1 : Entreprise ─── */}
          {step === "entreprise" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Votre entreprise</h2>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>Dites-nous comment s'appelle votre commerce.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nom de l'entreprise *</label>
                  <input style={inputStyle} placeholder="ex: Tech Plus, Commerce Awa..." value={entreprise} onChange={e => setEntreprise(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Pays *</label>
                    <select style={{ ...inputStyle, appearance: "none" }} value={pays} onChange={e => setPays(e.target.value)}>
                      {PAYS.map(p => <option key={p.code} value={p.code}>{p.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Ville</label>
                    <input style={inputStyle} placeholder="ex: Abidjan" value={ville} onChange={e => setVille(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input style={inputStyle} placeholder="ex: +225 07 00 00 00" value={telephone} onChange={e => setTel(e.target.value)} />
                </div>
              </div>

              <button
                disabled={!entreprise.trim()}
                onClick={() => setStep("compte")}
                style={{
                  width: "100%", marginTop: 24, padding: "13px", borderRadius: 12,
                  background: entreprise.trim() ? "linear-gradient(135deg, #00d4ff, #7c3aed)" : "#1e293b",
                  color: entreprise.trim() ? "#fff" : "#64748b",
                  fontWeight: 700, fontSize: 14, border: "none", cursor: entreprise.trim() ? "pointer" : "default",
                  fontFamily: "inherit",
                }}>
                Continuer →
              </button>
            </>
          )}

          {/* ── ÉTAPE 2 : Compte Admin ─── */}
          {step === "compte" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Votre compte admin</h2>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>Ce compte aura tous les droits sur votre espace.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nom complet *</label>
                  <input style={inputStyle} placeholder="ex: Jean Kouassi" value={nom} onChange={e => setNom(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" style={inputStyle} placeholder="vous@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Mot de passe * (min. 6 caractères)</label>
                  <input type="password" style={inputStyle} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Confirmer le mot de passe *</label>
                  <input type="password" style={inputStyle} placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
                  {confirm && password !== confirm && (
                    <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontFamily: "var(--font-dm-mono, monospace)" }}>
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep("entreprise")} style={{
                  flex: 1, padding: "12px", borderRadius: 12, background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>← Retour</button>
                <button
                  disabled={!nom || !email || !password || password !== confirm || password.length < 6}
                  onClick={() => setStep("boutiques")}
                  style={{
                    flex: 2, padding: "12px", borderRadius: 12,
                    background: (nom && email && password && password === confirm && password.length >= 6)
                      ? "linear-gradient(135deg, #00d4ff, #7c3aed)" : "#1e293b",
                    color: (nom && email && password && password === confirm && password.length >= 6) ? "#fff" : "#64748b",
                    fontWeight: 700, fontSize: 14, border: "none",
                    cursor: (nom && email && password && password === confirm && password.length >= 6) ? "pointer" : "default",
                    fontFamily: "inherit",
                  }}>
                  Continuer →
                </button>
              </div>
            </>
          )}

          {/* ── ÉTAPE 3 : Boutiques ─── */}
          {step === "boutiques" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Vos boutiques</h2>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
                La <span style={{ color: "#00d4ff" }}>1ère boutique</span> sera votre boutique principale.
                Vous pourrez en ajouter d'autres après.
              </p>

              <div style={{ marginBottom: 20 }}>
                {/* Toggle dépôt */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: 12,
                  background: avecDepot ? "rgba(0,212,255,0.05)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${avecDepot ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.08)"}`,
                  marginBottom: avecDepot ? 12 : 0, cursor: "pointer",
                }} onClick={() => setAvecDepot(!avecDepot)}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>📦 J'ai un dépôt / entrepôt</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      Lieu de stockage central séparé de vos boutiques
                    </div>
                  </div>
                  <div style={{
                    width: 44, height: 24, borderRadius: 99,
                    background: avecDepot ? "#00d4ff" : "rgba(255,255,255,0.1)",
                    position: "relative", flexShrink: 0, transition: "all 0.2s",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <div style={{
                      position: "absolute", top: 2,
                      left: avecDepot ? 22 : 2,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#fff", transition: "left 0.2s",
                    }} />
                  </div>
                </div>
                {avecDepot && (
                  <input style={inputStyle} placeholder="Dépôt Central" value={depotNom}
                    onChange={e => setDepotNom(e.target.value)} />
                )}
              </div>

              <div>
                <label style={labelStyle}>🏪 Points de vente</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {boutiques.map((b, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ position: "relative", flex: 1 }}>
                        <input
                          style={{ ...inputStyle, paddingRight: i === 0 ? 90 : 16 }}
                          placeholder={`ex: PDV ${["Plateau", "Cocody", "Yopougon"][i] ?? i + 1}`}
                          value={b} onChange={e => updateBoutique(i, e.target.value)}
                        />
                        {i === 0 && (
                          <span style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            fontSize: 10, color: "#00d4ff", background: "rgba(0,212,255,0.1)",
                            border: "1px solid rgba(0,212,255,0.3)", borderRadius: 6,
                            padding: "2px 8px", fontFamily: "var(--font-dm-mono, monospace)", fontWeight: 700,
                          }}>★ Principale</span>
                        )}
                      </div>
                      {boutiques.length > 1 && (
                        <button onClick={() => removeBoutique(i)} style={{
                          width: 36, height: 36, borderRadius: 8, background: "transparent",
                          border: "1px solid rgba(255,255,255,0.1)", color: "#64748b",
                          cursor: "pointer", fontSize: 16, flexShrink: 0,
                        }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addBoutique} style={{
                  width: "100%", marginTop: 8, padding: "10px", borderRadius: 10,
                  background: "transparent", border: "1px dashed rgba(255,255,255,0.15)",
                  color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}>+ Ajouter une boutique</button>
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "12px 16px", borderRadius: 10, fontSize: 13, marginTop: 16 }}>
                  ⚠ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep("compte")} style={{
                  flex: 1, padding: "12px", borderRadius: 12, background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>← Retour</button>
                <button
                  onClick={handleSubmit} disabled={loading}
                  style={{
                    flex: 2, padding: "12px", borderRadius: 12,
                    background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
                    color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
                    cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
                    fontFamily: "inherit",
                  }}>
                  {loading ? "Création en cours..." : "✓ Créer mon espace →"}
                </button>
              </div>
            </>
          )}

          {/* ── DONE ─── */}
          {step === "done" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px",
                background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
              }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Bienvenue sur GestoPro !</h2>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
                Votre espace <strong style={{ color: "#f1f5f9" }}>{entreprise}</strong> est prêt.
                Connectez-vous avec votre email <strong style={{ color: "#00d4ff" }}>{email}</strong>.
              </p>
              <div style={{ background: "#111827", borderRadius: 12, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
                {[
                  { k: "Entreprise", v: entreprise },
                  { k: "Email", v: email },
                  { k: "Boutiques", v: `${boutiques.filter(b => b.trim()).length} créée(s)` },
                  { k: "Plan", v: "Gratuit ✓" },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span style={{ fontSize: 12, color: "#64748b", fontFamily: "var(--font-dm-mono, monospace)" }}>{r.k}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push("/login")} style={{
                width: "100%", padding: "14px", borderRadius: 12,
                background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
                color: "#fff", fontWeight: 700, fontSize: 15, border: "none",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                Se connecter maintenant →
              </button>
            </div>
          )}
        </div>

        {step !== "done" && (
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#64748b" }}>
            Déjà un compte ?{" "}
            <Link href="/login" style={{ color: "#00d4ff", textDecoration: "none", fontWeight: 600 }}>
              Se connecter
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
