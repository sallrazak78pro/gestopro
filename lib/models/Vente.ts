// lib/models/Vente.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILigneVente {
  produit: mongoose.Types.ObjectId;
  nomProduit: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

export interface IVente extends Document {
  tenantId: mongoose.Types.ObjectId;
  reference: string;
  boutique: mongoose.Types.ObjectId;
  client?: string;
  // Employé qui a effectué la vente (peut différer du createdBy si enregistré par un manager)
  employe: mongoose.Types.ObjectId;
  employeNom: string; // snapshot du nom au moment de la vente
  lignes: ILigneVente[];
  montantTotal: number;
  montantRecu: number;
  monnaie: number;
  statut: "payee" | "en_attente" | "annulee";
  modePaiement: "especes" | "mobile_money" | "virement" | "cheque";
  note?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const LigneVenteSchema = new Schema<ILigneVente>({
  produit:      { type: Schema.Types.ObjectId, ref: "Produit", required: true },
  nomProduit:   { type: String, required: true },
  quantite:     { type: Number, required: true, min: 0 },
  prixUnitaire: { type: Number, required: true, min: 0 },
  sousTotal:    { type: Number, required: true, min: 0 },
});

const VenteSchema = new Schema<IVente>(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    reference:    { type: String, required: true, unique: true },
    boutique:     { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    client:       { type: String, default: "Client comptoir" },
    employe:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    employeNom:   { type: String, required: true },
    lignes:       [LigneVenteSchema],
    montantTotal: { type: Number, required: true, min: 0 },
    montantRecu:  { type: Number, default: 0 },
    monnaie:      { type: Number, default: 0 },
    statut: {
      type: String,
      enum: ["payee", "en_attente", "annulee"],
      default: "payee",
    },
    modePaiement: {
      type: String,
      enum: ["especes", "mobile_money", "virement", "cheque"],
      default: "especes",
    },
    note:      { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Vente: Model<IVente> =
  mongoose.models.Vente || mongoose.model<IVente>("Vente", VenteSchema);

export default Vente;
