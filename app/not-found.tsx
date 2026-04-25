// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }} />
      </div>

      <div className="relative text-center max-w-md">
        <div className="text-[120px] font-extrabold font-mono leading-none mb-4"
          style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          404
        </div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--color-fg)" }}>
          Page introuvable
        </h1>
        <p className="text-muted text-sm mb-8 leading-relaxed">
          La page que tu cherches n&apos;existe pas ou a été déplacée.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard"
            className="btn-primary">
            ← Tableau de bord
          </Link>
          <Link href="/"
            className="btn-ghost">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
