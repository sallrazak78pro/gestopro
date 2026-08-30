// lib/utils/date.ts
// `Date.prototype.toISOString()` convertit toujours en UTC — pour un
// utilisateur dont le fuseau horaire est en avance sur UTC (courant en
// Afrique/Europe), minuit local le 1er du mois correspond encore à la veille
// en UTC, et toISOString() renvoie alors le dernier jour du mois précédent.
// Cette fonction lit les composants de date locaux (année/mois/jour tels
// qu'affichés à l'utilisateur), sans jamais repasser par UTC.
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
