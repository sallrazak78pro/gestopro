// lib/models/Catalogue.ts
// Stocke les catégories et unités personnalisées de chaque tenant
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICatalogue extends Document {
  tenantId: mongoose.Types.ObjectId;
  type: "categorie" | "unite";
  valeur: string;   // ex: "Électronique", "Carton", "Litre"
  icone?: string;   // emoji optionnel
  actif: boolean;
  createdAt: Date;
}

const CatalogueSchema = new Schema<ICatalogue>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    type:     { type: String, enum: ["categorie", "unite"], required: true },
    valeur:   { type: String, required: true, trim: true },
    icone:    { type: String, default: "" },
    actif:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Un tenant ne peut pas avoir deux fois la même valeur pour le même type
CatalogueSchema.index({ tenantId: 1, type: 1, valeur: 1 }, { unique: true });

const Catalogue: Model<ICatalogue> =
  mongoose.models.Catalogue ||
  mongoose.model<ICatalogue>("Catalogue", CatalogueSchema);

export default Catalogue;
