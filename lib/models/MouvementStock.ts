// lib/models/MouvementStock.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMouvementStock extends Document {
  tenantId:     mongoose.Types.ObjectId;
  reference:    string;
  boutique:     mongoose.Types.ObjectId;
  type:         "entree" | "sortie";
  produit:      mongoose.Types.ObjectId;
  quantite:     number;
  prixUnitaire: number;
  montant:      number;
  motif?:       string;
  transfertRef?: string;  // shared between the two legs of a transfer
  createdBy:    mongoose.Types.ObjectId;
  createdAt:    Date;
  updatedAt:    Date;
}

const schema = new Schema<IMouvementStock>(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant",  required: true },
    reference:    { type: String, required: true, unique: true },
    boutique:     { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    type:         { type: String, enum: ["entree", "sortie"], required: true },
    produit:      { type: Schema.Types.ObjectId, ref: "Produit",  required: true },
    quantite:     { type: Number, required: true, min: 0.001 },
    prixUnitaire: { type: Number, required: true, default: 0 },
    montant:      { type: Number, required: true, default: 0 },
    motif:        { type: String, default: "" },
    transfertRef: { type: String, default: null },
    createdBy:    { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

schema.index({ tenantId: 1, boutique: 1, createdAt: -1 });
schema.index({ transfertRef: 1 });

const MouvementStock: Model<IMouvementStock> =
  mongoose.models.MouvementStock ||
  mongoose.model<IMouvementStock>("MouvementStock", schema);

export default MouvementStock;
