// lib/models/Stock.ts
// Une entrée Stock = un produit dans une boutique/dépôt spécifique
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStock extends Document {
  tenantId: mongoose.Types.ObjectId;
  produit: mongoose.Types.ObjectId;
  boutique: mongoose.Types.ObjectId;
  quantite: number;
  prixVente?: number;      // prix de vente dans la devise de cette boutique
  prixAchatLocal?: number; // dernier coût d'achat converti dans la devise de cette boutique
  updatedAt: Date;
}

const StockSchema = new Schema<IStock>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    produit: { type: Schema.Types.ObjectId, ref: "Produit", required: true },
    boutique: { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    quantite: { type: Number, required: true, min: 0, default: 0 },
    prixVente: { type: Number, default: null },
    prixAchatLocal: { type: Number, default: null },
  },
  { timestamps: true }
);

// Index unique : un produit ne peut avoir qu'une entrée par boutique
StockSchema.index({ produit: 1, boutique: 1 }, { unique: true });

const Stock: Model<IStock> =
  mongoose.models.Stock || mongoose.model<IStock>("Stock", StockSchema);

export default Stock;
