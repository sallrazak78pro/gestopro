// lib/models/CompteTiers.ts
// Représente une personne qui dépose son argent dans une boutique
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICompteTiers extends Document {
  tenantId: mongoose.Types.ObjectId;
  nom: string;
  telephone?: string;
  boutique: mongoose.Types.ObjectId; // boutique où est tenu le compte
  solde: number;                     // solde actuel en temps réel
  actif: boolean;
  createdAt: Date;
}

const CompteTiersSchema = new Schema<ICompteTiers>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    nom: { type: String, required: true, trim: true },
    telephone: { type: String, default: "" },
    boutique: { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    solde: { type: Number, default: 0, min: 0 },
    actif: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const CompteTiers: Model<ICompteTiers> =
  mongoose.models.CompteTiers ||
  mongoose.model<ICompteTiers>("CompteTiers", CompteTiersSchema);

export default CompteTiers;
