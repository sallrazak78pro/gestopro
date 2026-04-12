// lib/models/MouvementStock.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export type TypeMouvement = "depot_vers_boutique" | "boutique_vers_boutique" | "entree_fournisseur" | "sortie_perte";

export interface IMouvementStock extends Document {
  tenantId: mongoose.Types.ObjectId;
  reference: string;
  type: TypeMouvement;
  produit: mongoose.Types.ObjectId;
  source: mongoose.Types.ObjectId | null;       // boutique/dépôt d'où vient la marchandise
  destination: mongoose.Types.ObjectId | null;  // boutique/dépôt qui reçoit
  quantite: number;
  motif?: string;
  statut: "en_cours" | "livre" | "annule";
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MouvementStockSchema = new Schema<IMouvementStock>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    reference: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["depot_vers_boutique", "boutique_vers_boutique", "entree_fournisseur", "sortie_perte"],
      required: true,
    },
    produit: { type: Schema.Types.ObjectId, ref: "Produit", required: true },
    source: { type: Schema.Types.ObjectId, ref: "Boutique", default: null },
    destination: { type: Schema.Types.ObjectId, ref: "Boutique", default: null },
    quantite: { type: Number, required: true, min: 1 },
    motif: { type: String, default: "" },
    statut: {
      type: String,
      enum: ["en_cours", "livre", "annule"],
      default: "en_cours",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const MouvementStock: Model<IMouvementStock> =
  mongoose.models.MouvementStock ||
  mongoose.model<IMouvementStock>("MouvementStock", MouvementStockSchema);

export default MouvementStock;
