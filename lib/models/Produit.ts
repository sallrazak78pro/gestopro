// lib/models/Produit.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduit extends Document {
  tenantId: mongoose.Types.ObjectId;
  reference: string;
  nom: string;
  description?: string;
  categorie: string;
  prixAchat: number;
  prixVente: number;
  seuilAlerte: number;
  unite: string;
  image?: string; // base64 ou URL
  actif: boolean;
  createdAt: Date;
}

const ProduitSchema = new Schema<IProduit>(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    reference:   { type: String, required: true, unique: true, uppercase: true },
    nom:         { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    categorie:   { type: String, required: true },
    prixAchat:   { type: Number, required: true, min: 0 },
    prixVente:   { type: Number, required: true, min: 0 },
    seuilAlerte: { type: Number, default: 5 },
    unite:       { type: String, default: "pièce" },
    image:       { type: String, default: "" }, // base64 ou URL externe
    actif:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Produit: Model<IProduit> =
  mongoose.models.Produit ||
  mongoose.model<IProduit>("Produit", ProduitSchema);

export default Produit;
