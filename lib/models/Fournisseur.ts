// lib/models/Fournisseur.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFournisseur extends Document {
  tenantId:    mongoose.Types.ObjectId;
  nom:         string;
  contact?:    string;
  telephone?:  string;
  email?:      string;
  adresse?:    string;
  ville?:      string;
  pays?:       string;
  notes?:      string;
  soldeCredit: number; // montant total dû à ce fournisseur
  actif:       boolean;
  createdAt:   Date;
}

const FournisseurSchema = new Schema<IFournisseur>(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    nom:         { type: String, required: true, trim: true },
    contact:     { type: String, default: "" },
    telephone:   { type: String, default: "" },
    email:       { type: String, default: "" },
    adresse:     { type: String, default: "" },
    ville:       { type: String, default: "" },
    pays:        { type: String, default: "" },
    notes:       { type: String, default: "" },
    soldeCredit: { type: Number, default: 0 },
    actif:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Fournisseur: Model<IFournisseur> =
  mongoose.models.Fournisseur ||
  mongoose.model<IFournisseur>("Fournisseur", FournisseurSchema);

export default Fournisseur;
