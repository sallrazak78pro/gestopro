// lib/utils/periodeStats.ts
// Période de statistiques visible par rôle, réglée par l'admin dans
// Paramètres → Permissions. Glissante (relative à aujourd'hui), elle n'a
// jamais besoin d'être mise à jour. Admin et superadmin voient toujours tout.
// Sans dépendance serveur : importable par les routes API comme par les pages.

export type PeriodeStats = "illimite" | "jour" | "7j" | "mois" | "30j";

export const PERIODES_STATS: { value: PeriodeStats; label: string }[] = [
  { value: "illimite", label: "Illimitée" },
  { value: "jour",     label: "Aujourd'hui seulement" },
  { value: "7j",       label: "7 derniers jours" },
  { value: "mois",     label: "Mois en cours" },
  { value: "30j",      label: "30 derniers jours" },
];

export function estPeriodeStats(v: unknown): v is PeriodeStats {
  return PERIODES_STATS.some(p => p.value === v);
}

export function libellePeriode(periode: PeriodeStats): string {
  return PERIODES_STATS.find(p => p.value === periode)?.label ?? periode;
}

/** Période réglée pour ce rôle — illimitée pour admin/superadmin, ou si rien n'est configuré. */
export function periodePourRole(role: string, periodeStats: unknown): PeriodeStats {
  if (role !== "gestionnaire" && role !== "caissier") return "illimite";
  const v = (periodeStats as Record<string, unknown> | null | undefined)?.[role];
  return estPeriodeStats(v) ? v : "illimite";
}

/** Premier instant visible (minuit, heure locale) pour cette période — null si illimitée. */
export function debutPeriode(periode: PeriodeStats, now = new Date()): Date | null {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (periode) {
    case "jour": return new Date(y, m, d);
    case "7j":   return new Date(y, m, d - 6);
    case "30j":  return new Date(y, m, d - 29);
    case "mois": return new Date(y, m, 1);
    default:     return null;
  }
}

export interface PeriodeLimitee {
  periode: PeriodeStats;
  depuis: Date;
}

/**
 * Resserre query[champ] (filtre { $gte, $lte }) pour ne jamais remonter avant
 * la période autorisée du rôle. Retourne la limite appliquée — à renvoyer au
 * client pour qu'il affiche le bandeau — ou null si la période est illimitée.
 */
export function limiterPeriode(
  ctx: { role: string; periodeStats?: unknown },
  query: Record<string, any>,
  champ = "createdAt",
): PeriodeLimitee | null {
  const periode = periodePourRole(ctx.role, ctx.periodeStats);
  const depuis = debutPeriode(periode);
  if (!depuis) return null;
  const filtre = query[champ] ?? {};
  if (!filtre.$gte || new Date(filtre.$gte) < depuis) filtre.$gte = depuis;
  query[champ] = filtre;
  return { periode, depuis };
}
