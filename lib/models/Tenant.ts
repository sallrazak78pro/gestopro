// lib/models/Tenant.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITenant extends Document {
  nom: string;
  slug: string;
  email: string;
  telephone?: string;
  pays: string;
  ville?: string;
  plan: "gratuit" | "pro" | "enterprise";
  statut: "actif" | "suspendu" | "essai";
  dateExpiration?: Date;
  nbBoutiquesMax: number;
  nbUsersMax: number;
  gestionStockStricte: boolean;
  mouvementsActifs: boolean; // transferts entre boutiques activés
  createdAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    nom:      { type: String, required: true, trim: true },
    slug:     { type: String, required: true, unique: true, lowercase: true },
    email:    { type: String, required: true, lowercase: true },
    telephone:{ type: String, default: "" },
    pays:     { type: String, default: "CI" },
    ville:    { type: String, default: "" },
    plan:     { type: String, enum: ["gratuit", "pro", "enterprise"], default: "gratuit" },
    statut:   { type: String, enum: ["actif", "suspendu", "essai"], default: "actif" },
    dateExpiration: { type: Date, default: null },
    nbBoutiquesMax: { type: Number, default: 5 },
    nbUsersMax:     { type: Number, default: 10 },
    gestionStockStricte: { type: Boolean, default: false },
    mouvementsActifs:    { type: Boolean, default: true }, // activé par défaut
  },
  { timestamps: true }
);

const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;
