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
  mouvementsActifs: boolean; // transferts entre boutiques activés
  // Permissions par rôle configurables depuis Paramètres — voir
  // lib/utils/permissions.ts pour la forme exacte et les valeurs par défaut.
  permissions: Record<string, unknown>;
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
    mouvementsActifs: { type: Boolean, default: true }, // activé par défaut
    permissions: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;
