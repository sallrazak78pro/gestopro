// components/ui/BandeauPeriodeLimitee.tsx
// Bandeau affiché quand l'API a ramené les dates à la période de statistiques
// autorisée pour le rôle de l'utilisateur (Paramètres → Permissions).
"use client";
import { libellePeriode, type PeriodeStats } from "@/lib/utils/periodeStats";
import { toLocalISODate } from "@/lib/utils/date";

/** Forme de `periodeLimitee` dans les réponses JSON des routes de statistiques. */
export interface PeriodeLimiteeClient {
  periode: PeriodeStats;
  depuis: string;
}

/** Date minimale (AAAA-MM-JJ) à proposer dans les calendriers — undefined si illimitée. */
export function dateMinLimite(limite?: PeriodeLimiteeClient | null): string | undefined {
  return limite ? toLocalISODate(new Date(limite.depuis)) : undefined;
}

export default function BandeauPeriodeLimitee({ limite }: { limite?: PeriodeLimiteeClient | null }) {
  if (!limite) return null;
  const depuis = new Date(limite.depuis).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  return (
    <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-warning">
      <span>🔒</span>
      <span>
        Période limitée par l&apos;administrateur : <strong>{libellePeriode(limite.periode)}</strong>
        <span className="text-muted"> — données affichées à partir du {depuis}.</span>
      </span>
    </div>
  );
}
