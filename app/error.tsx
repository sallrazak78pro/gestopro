// app/error.tsx
"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erreur GestoPro:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}>
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--color-fg)" }}>
          Une erreur est survenue
        </h1>
        <p className="text-muted text-sm mb-2 leading-relaxed">
          Quelque chose s&apos;est mal passé. Tu peux réessayer ou retourner au tableau de bord.
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono text-muted mb-6">Code : {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            🔄 Réessayer
          </button>
          <a href="/dashboard" className="btn-ghost">
            ← Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
