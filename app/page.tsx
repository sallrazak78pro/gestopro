// app/page.tsx — Landing page GestoPro
import Link from "next/link";

const FEATURES = [
  {
    icon: "🧾",
    title: "Ventes & Caisse",
    desc: "Enregistrez chaque vente en quelques secondes. Suivi des encaissements, ventes à crédit, historique complet par caissier et par boutique.",
    color: "#00d4ff",
  },
  {
    icon: "📦",
    title: "Stock & Inventaire",
    desc: "Visualisez vos quantités en temps réel par boutique et par dépôt. Alertes automatiques dès qu'un produit passe sous le seuil critique.",
    color: "#7c3aed",
  },
  {
    icon: "🔄",
    title: "Mouvements de marchandise",
    desc: "Transférez des produits d'un dépôt vers une boutique ou entre boutiques. Chaque mouvement est tracé, daté et signé.",
    color: "#10b981",
  },
  {
    icon: "💰",
    title: "Trésorerie",
    desc: "Suivez votre argent au centime près. Versements, avances, dépenses, soldes par caisse et par banque — vue consolidée en temps réel.",
    color: "#f59e0b",
  },
  {
    icon: "🏭",
    title: "Fournisseurs & Commandes",
    desc: "Gérez vos fournisseurs, passez des commandes d'approvisionnement, suivez les livraisons et les montants dus.",
    color: "#ef4444",
  },
  {
    icon: "👷",
    title: "Employés & Salaires",
    desc: "Fiches employés, rôles par boutique, calcul des salaires mensuels, avances sur salaire et historique des paiements.",
    color: "#06b6d4",
  },
  {
    icon: "👥",
    title: "Comptes Tiers",
    desc: "Gérez les comptes de vos clients fidèles. Dépôts, retraits, soldes à vue. Zéro confusion sur qui doit quoi.",
    color: "#8b5cf6",
  },
  {
    icon: "📊",
    title: "Tableau de bord & Marges",
    desc: "KPIs clés, graphiques d'évolution, répartition du CA par point de vente, analyse des marges produit par produit.",
    color: "#00d4ff",
  },
  {
    icon: "🏪",
    title: "Multi-boutiques & Dépôts",
    desc: "Gérez plusieurs points de vente et entrepôts depuis un seul compte. Chaque boutique garde ses données isolées.",
    color: "#10b981",
  },
  {
    icon: "🔔",
    title: "Alertes intelligentes",
    desc: "Ruptures de stock, caisses ouvertes, versements en attente, commandes à traiter — vous êtes alerté avant que ça devienne un problème.",
    color: "#f59e0b",
  },
  {
    icon: "📥",
    title: "Import Excel",
    desc: "Importez votre catalogue produits depuis un fichier Excel. Détection automatique des doublons et validation champ par champ.",
    color: "#7c3aed",
  },
  {
    icon: "🖨️",
    title: "Impressions & Exports",
    desc: "Imprimez vos états de stock, vos factures et vos rapports. Exportez en CSV pour Excel. Pensé pour le terrain.",
    color: "#ef4444",
  },
];

const STEPS = [
  { n: "01", icon: "✏️", title: "Créez votre compte", desc: "Renseignez votre entreprise, vos boutiques et votre dépôt. Prêt en 5 minutes." },
  { n: "02", icon: "📦", title: "Ajoutez vos produits", desc: "Saisissez ou importez votre catalogue. Prix d'achat, prix de vente, seuils d'alerte." },
  { n: "03", icon: "👤", title: "Invitez votre équipe", desc: "Créez des comptes Admin, Gestionnaire ou Caissier avec les bons droits d'accès." },
  { n: "04", icon: "⚡", title: "Gérez en temps réel", desc: "Ventes, stocks, trésorerie, mouvements — tout se synchronise instantanément." },
];

const STATS = [
  { v: "12", l: "Modules intégrés" },
  { v: "∞",  l: "Boutiques gérées" },
  { v: "100%", l: "Gratuit" },
];

export default function LandingPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      color: "#0f172a",
      fontFamily: "var(--font-syne, 'Syne', system-ui, sans-serif)",
      overflowX: "hidden",
    }}>

      {/* ── NAVBAR ───────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(248,250,252,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 5%",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 15, color: "#fff", flexShrink: 0,
          }}>G</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>GestoPro</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/login" style={{
            color: "#64748b", textDecoration: "none", fontSize: 14,
            fontWeight: 600, padding: "8px 16px", borderRadius: 8,
            border: "1px solid #e2e8f0", background: "#fff",
          }}>Connexion</Link>
          <Link href="/register" style={{
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700,
            padding: "9px 20px", borderRadius: 10,
            boxShadow: "0 2px 12px rgba(0,212,255,0.25)",
          }}>Démarrer →</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 5% 72px",
        textAlign: "center",
        position: "relative",
        background: "linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)",
        borderBottom: "1px solid #e2e8f0",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
          borderRadius: 100, padding: "5px 14px", fontSize: 12,
          color: "#0891b2", fontFamily: "var(--font-dm-mono, monospace)",
          letterSpacing: "0.05em", marginBottom: 28, fontWeight: 600,
        }}>
          ✦ ERP complet pour commerçants · 100 % gratuit
        </div>

        <h1 style={{
          fontSize: "clamp(32px, 5vw, 60px)",
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 20,
          color: "#0f172a",
          maxWidth: 820,
          margin: "0 auto 20px",
          letterSpacing: "-0.5px",
        }}>
          Gérez votre commerce{" "}
          <span style={{
            background: "linear-gradient(135deg, #00b4d8, #7c3aed)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            comme un pro
          </span>
        </h1>

        <p style={{
          fontSize: 17,
          color: "#475569",
          maxWidth: 540,
          margin: "0 auto 40px",
          lineHeight: 1.75,
          fontWeight: 400,
        }}>
          Ventes, stock, trésorerie, fournisseurs, salaires, alertes —
          tout centralisé dans un seul outil pensé pour les commerçants africains.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 60 }}>
          <Link href="/register" style={{
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700,
            padding: "13px 30px", borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,212,255,0.3)",
          }}>
            Créer mon compte gratuit →
          </Link>
          <Link href="/login" style={{
            background: "#fff", border: "1px solid #e2e8f0",
            color: "#334155", textDecoration: "none", fontSize: 15, fontWeight: 600,
            padding: "13px 30px", borderRadius: 12,
          }}>
            Se connecter
          </Link>
        </div>

        {/* Stats */}
        <div style={{
          display: "inline-flex", gap: 0,
          background: "#fff", border: "1px solid #e2e8f0",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              padding: "20px 36px", textAlign: "center",
              borderRight: i < STATS.length - 1 ? "1px solid #e2e8f0" : "none",
            }}>
              <div style={{
                fontSize: 30, fontWeight: 800, color: "#0f172a",
                lineHeight: 1, marginBottom: 4,
              }}>{s.v}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "var(--font-dm-mono, monospace)", fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES GRID ────────────────────────────────────── */}
      <section style={{ padding: "80px 5%", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{
            fontSize: 11, fontFamily: "var(--font-dm-mono, monospace)",
            color: "#0891b2", letterSpacing: "0.15em", textTransform: "uppercase",
            marginBottom: 12, fontWeight: 600,
          }}>12 modules intégrés</p>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800, color: "#0f172a", marginBottom: 12, letterSpacing: "-0.3px" }}>
            Tout ce qu&apos;il vous faut, rien de superflu
          </h2>
          <p style={{ color: "#64748b", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
            Une suite pensée pour votre réalité terrain — pas pour une multinationale.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 20,
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: "24px 22px",
              borderTop: `3px solid ${f.color}`,
              transition: "box-shadow 0.2s, transform 0.2s",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${f.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, marginBottom: 16,
              }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section style={{
        padding: "80px 5%",
        background: "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)",
        borderTop: "1px solid #e2e8f0",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{
              fontSize: 11, fontFamily: "var(--font-dm-mono, monospace)",
              color: "#0891b2", letterSpacing: "0.15em", textTransform: "uppercase",
              marginBottom: 12, fontWeight: 600,
            }}>Démarrage rapide</p>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800, color: "#0f172a", marginBottom: 12, letterSpacing: "-0.3px" }}>
              Opérationnel en 4 étapes
            </h2>
            <p style={{ color: "#64748b", fontSize: 15 }}>Pas de formation. Pas de carte bancaire. Juste votre email.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 16,
                border: "1px solid #e2e8f0",
                padding: "28px 22px", textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, margin: "0 auto 18px",
                  background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))",
                  border: "1px solid rgba(0,212,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>{s.icon}</div>
                <div style={{
                  display: "inline-block",
                  fontSize: 10, fontFamily: "var(--font-dm-mono, monospace)",
                  color: "#0891b2", letterSpacing: "0.1em",
                  background: "rgba(0,212,255,0.08)", borderRadius: 4,
                  padding: "2px 8px", marginBottom: 10, fontWeight: 700,
                }}>{s.n}</div>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ────────────────────────────────────────────── */}
      <section style={{ padding: "80px 5%", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{
            fontSize: 11, fontFamily: "var(--font-dm-mono, monospace)",
            color: "#0891b2", letterSpacing: "0.15em", textTransform: "uppercase",
            marginBottom: 12, fontWeight: 600,
          }}>Gestion des accès</p>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800, color: "#0f172a", marginBottom: 12, letterSpacing: "-0.3px" }}>
            Chaque rôle a ses droits
          </h2>
          <p style={{ color: "#64748b", fontSize: 15 }}>Contrôlez précisément qui voit quoi et qui peut faire quoi.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {[
            { icon: "⚡", role: "Super Admin",  color: "#00d4ff", desc: "Gestion de la plateforme multi-tenant. Vision globale." },
            { icon: "👑", role: "Admin",         color: "#7c3aed", desc: "Accès complet à toutes les données de l'entreprise." },
            { icon: "📊", role: "Gestionnaire",  color: "#10b981", desc: "Supervision des ventes, stocks et trésorerie." },
            { icon: "🏧", role: "Caissier",      color: "#f59e0b", desc: "Caisse, ventes et consultation du stock assigné." },
          ].map((r, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
              padding: "22px 18px", textAlign: "center",
              borderBottom: `3px solid ${r.color}`,
            }}>
              <div style={{
                fontSize: 28, marginBottom: 12,
                width: 48, height: 48, borderRadius: 12, margin: "0 auto 12px",
                background: `${r.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{r.icon}</div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 6 }}>{r.role}</p>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 5%",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 24px",
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 24, color: "#fff",
          }}>G</div>
          <h2 style={{
            fontSize: "clamp(26px, 3.5vw, 40px)",
            fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.3px",
          }}>
            Prêt à prendre le contrôle ?
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 16, marginBottom: 36, lineHeight: 1.7 }}>
            Rejoignez les commerçants qui pilotent leur business avec précision.
            C&apos;est gratuit, et ça le reste.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" style={{
              background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
              color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700,
              padding: "14px 32px", borderRadius: 12,
              boxShadow: "0 4px 24px rgba(0,212,255,0.35)",
            }}>
              Créer mon compte gratuit →
            </Link>
            <Link href="/login" style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#e2e8f0", textDecoration: "none", fontSize: 15, fontWeight: 600,
              padding: "14px 32px", borderRadius: 12,
            }}>
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{
        background: "#0f172a",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "28px 5%",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 13, color: "#fff",
          }}>G</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>GestoPro</span>
        </div>
        <p style={{ fontSize: 13, color: "#475569", fontFamily: "var(--font-dm-mono, monospace)" }}>
          © {new Date().getFullYear()} GestoPro · Made for African commerce 🌍
        </p>
        <div style={{ display: "flex", gap: 20 }}>
          <Link href="/login"    style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>Connexion</Link>
          <Link href="/register" style={{ color: "#00d4ff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>S&apos;inscrire</Link>
        </div>
      </footer>
    </div>
  );
}
