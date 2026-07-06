// lib/utils/reference.ts
// Génère des références séquentielles uniques par tenant : FCT-2026-0087,
// MV-2026-0012, etc.
//
// Utilise un compteur atomique ($inc via findOneAndUpdate) plutôt qu'un
// countDocuments() suivi d'un create() : ce dernier pattern laisse une
// fenêtre où deux requêtes concurrentes comptent le même nombre de
// documents existants et génèrent donc la même "prochaine" référence,
// ce qui viole l'index unique {tenantId, reference} et lève une erreur
// Mongo E11000 (duplicate key). Le $inc est atomique côté serveur MongoDB
// et élimine cette fenêtre de course.
import Counter from "@/lib/models/Counter";

export async function genererReference(
  tenantId: string,
  cle: string,
  digits = 4
): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: `${tenantId}:${cle}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `${cle}-${String(counter.seq).padStart(digits, "0")}`;
}
