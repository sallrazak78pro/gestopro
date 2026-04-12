// lib/models/Boutique.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBoutique extends Document {
  tenantId: mongoose.Types.ObjectId;
  nom: string;
  type: "boutique" | "depot";
  estPrincipale: boolean; // boutique qui centralise l'argent
  adresse?: string;
  telephone?: string;
  actif: boolean;
  createdAt: Date;
}

const BoutiqueSchema = new Schema<IBoutique>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    nom: { type: String, required: true, trim: true },
    type: { type: String, enum: ["boutique", "depot"], default: "boutique" },
    estPrincipale: { type: Boolean, default: false },
    adresse: { type: String, default: "" },
    telephone: { type: String, default: "" },
    actif: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Boutique: Model<IBoutique> =
  mongoose.models.Boutique ||
  mongoose.model<IBoutique>("Boutique", BoutiqueSchema);

export default Boutique;
