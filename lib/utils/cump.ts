// lib/utils/cump.ts
// CUMP = coût unitaire moyen pondéré (norme OHADA). Utilisé pour blender le
// coût d'un nouvel arrivage avec le coût du stock déjà en place, plutôt que
// d'écraser le coût existant à chaque réception/transfert.

export function calculerCUMP(
  qteAvant: number,
  coutAvant: number,
  qteRecue: number,
  coutRecue: number
): number {
  const qteApres = qteAvant + qteRecue;
  if (qteApres <= 0) return coutRecue;
  return (qteAvant * coutAvant + qteRecue * coutRecue) / qteApres;
}
