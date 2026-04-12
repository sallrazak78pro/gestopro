// app/page.tsx  — Landing page publique
import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#070b14",
      color: "#f1f5f9",
      fontFamily: "var(--font-syne, 'Syne', sans-serif)",
      overflowX: "hidden",
    }}>

      {/* ── NAV ──────────────────────────────────────────── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 40px", position: "sticky", top: 0, zIndex: 50,
        background: "rgba(7,11,20,0.8)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 16, color: "#fff",
          }}>G</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>GestoPro</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/login" style={{
            color: "#94a3b8", textDecoration: "none", fontSize: 14, fontWeight: 500,
          }}>Connexion</Link>
          <Link href="/register" style={{
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700,
            padding: "9px 20px", borderRadius: 10,
          }}>Démarrer gratuitement →</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{
        textAlign: "center", padding: "100px 20px 80px",
        position: "relative",
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400,
          background: "radial-gradient(ellipse, rgba(0,212,255,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
          borderRadius: 100, padding: "6px 16px", fontSize: 12,
          color: "#00d4ff", fontFamily: "var(--font-dm-mono, monospace)",
          letterSpacing: "0.1em", marginBottom: 32,
        }}>
          ✦ 100% gratuit · Aucune carte requise
        </div>

        <h1 style={{
          fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 800,
          letterSpacing: -2, lineHeight: 1.05, marginBottom: 24,
          maxWidth: 900, margin: "0 auto 24px",
        }}>
          Gérez votre commerce{" "}
          <span style={{
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            comme un pro
          </span>
        </h1>

        <p style={{
          fontSize: 18, color: "#94a3b8", maxWidth: 560,
          margin: "0 auto 48px", lineHeight: 1.7,
        }}>
          Ventes, stock, trésorerie, mouvements de marchandise —
          tout centralisé en un seul outil pensé pour les commerçants africains.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700,
            padding: "14px 32px", borderRadius: 12, display: "inline-block",
            boxShadow: "0 0 30px rgba(0,212,255,0.2)",
          }}>
            Créer mon compte gratuit →
          </Link>
          <Link href="/login" style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#f1f5f9", textDecoration: "none", fontSize: 15, fontWeight: 600,
            padding: "14px 32px", borderRadius: 12, display: "inline-block",
          }}>
            Se connecter
          </Link>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", gap: 48, justifyContent: "center",
          marginTop: 64, flexWrap: "wrap",
        }}>
          {[
            { v: "5 min", l: "Pour démarrer" },
            { v: "100%", l: "Gratuit" },
            { v: "∞", l: "Boutiques gérées" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 36, fontWeight: 800, letterSpacing: -1,
                background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>{s.v}</div>
              <div style={{ fontSize: 13, color: "#64748b", fontFamily: "var(--font-dm-mono, monospace)", marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section style={{ padding: "80px 20px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 12 }}>
            Tout ce qu'il vous faut
          </h2>
          <p style={{ color: "#64748b", fontSize: 16 }}>
            Une suite complète pensée pour votre réalité terrain
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {[
            {
              icon: "🧾", title: "Ventes & Facturation",
              desc: "Caisse rapide, factures automatiques, suivi des encaissements et des ventes à crédit.",
              color: "#00d4ff",
            },
            {
              icon: "📦", title: "Stock & Inventaire",
              desc: "Vue en temps réel de vos quantités par boutique. Alertes automatiques quand le stock est faible.",
              color: "#7c3aed",
            },
            {
              icon: "🔄", title: "Mouvements de marchandise",
              desc: "Dépôt vers boutique, boutique vers boutique. Chaque déplacement tracé et historisé.",
              color: "#10b981",
            },
            {
              icon: "💰", title: "Trésorerie",
              desc: "Versements hebdo, avances de caisse, dépenses, comptes tiers. Votre argent maîtrisé.",
              color: "#f59e0b",
            },
            {
              icon: "👥", title: "Comptes Tiers",
              desc: "Vos clients qui gardent de l'argent chez vous. Dépôts et retraits à la demande.",
              color: "#ef4444",
            },
            {
              icon: "📊", title: "Tableau de bord",
              desc: "CA, stock, flux de trésorerie, répartition par PDV. Tout en un coup d'œil.",
              color: "#00d4ff",
            },
          ].map((f, i) => (
            <div key={i} style={{
              background: "#0d1424", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20, padding: "28px 24px",
              transition: "border-color 0.2s",
              borderTop: `2px solid ${f.color}`,
            }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section style={{
        padding: "80px 20px",
        background: "rgba(13,20,36,0.6)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 12 }}>
            Démarrez en 5 minutes
          </h2>
          <p style={{ color: "#64748b", fontSize: 16, marginBottom: 56 }}>
            Pas de carte bancaire. Pas de formation. Juste votre email.
          </p>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { n: "01", title: "Créez votre compte", desc: "Renseignez vos boutiques et votre dépôt lors de l'inscription." },
              { n: "02", title: "Ajoutez vos produits", desc: "Importez votre catalogue et configurez les prix et seuils d'alerte." },
              { n: "03", title: "Gérez en temps réel", desc: "Ventes, stock, trésorerie — tout se met à jour automatiquement." },
            ].map((s, i) => (
              <div key={i} style={{
                flex: "1 1 200px", textAlign: "center",
                padding: "24px 20px",
                background: "#0d1424", borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px",
                  background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))",
                  border: "1px solid rgba(0,212,255,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#00d4ff",
                  fontFamily: "var(--font-dm-mono, monospace)",
                }}>
                  {s.n}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section style={{ padding: "100px 20px", textAlign: "center" }}>
        <div style={{
          maxWidth: 600, margin: "0 auto",
          background: "linear-gradient(135deg, rgba(0,212,255,0.05), rgba(124,58,237,0.05))",
          border: "1px solid rgba(0,212,255,0.2)", borderRadius: 24, padding: "56px 40px",
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>
            Prêt à prendre le contrôle ?
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 16, marginBottom: 36, lineHeight: 1.7 }}>
            Rejoignez les commerçants qui gèrent leur business intelligemment.
            C'est gratuit, et ça le reste.
          </p>
          <Link href="/register" style={{
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            color: "#fff", textDecoration: "none", fontSize: 16, fontWeight: 700,
            padding: "16px 40px", borderRadius: 12, display: "inline-block",
            boxShadow: "0 0 40px rgba(0,212,255,0.25)",
          }}>
            Créer mon compte — c'est gratuit →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "32px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 13, color: "#fff",
          }}>G</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>GestoPro</span>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", fontFamily: "var(--font-dm-mono, monospace)" }}>
          © {new Date().getFullYear()} GestoPro · Made for African commerce 🌍
        </p>
        <div style={{ display: "flex", gap: 20 }}>
          <Link href="/login"    style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>Connexion</Link>
          <Link href="/register" style={{ color: "#00d4ff", textDecoration: "none", fontSize: 13 }}>S'inscrire</Link>
        </div>
      </footer>
    </div>
  );
}
