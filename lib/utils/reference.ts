// lib/utils/reference.ts
// Génère des références uniques horodatées : FCT-2026-0087, MV-2026-0012, etc.

import mongoose from "mongoose";

export async function genererReference(
  prefix: string,
  collection: mongoose.Model<any>
): Promise<string> {
  const annee = new Date().getFullYear();
  const count = await collection.countDocuments();
  return `${prefix}-${annee}-${String(count + 1).padStart(4, "0")}`;
}
