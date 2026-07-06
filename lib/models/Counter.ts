// lib/models/Counter.ts
// Compteurs atomiques utilisés pour générer des références séquentielles
// (CMD-2026-0001, MV-2026-0001...) sans condition de course : contrairement
// à un `countDocuments()` suivi d'un `create()`, le $inc ci-dessous est une
// opération atomique unique côté MongoDB — deux requêtes concurrentes ne
// peuvent jamais recevoir le même numéro.
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICounter extends Omit<Document, "_id"> {
  _id: string; // `${tenantId}:${cle}`, ex: "64f...:MV-2026"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);

export default Counter;
