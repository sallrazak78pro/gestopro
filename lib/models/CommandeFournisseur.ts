// lib/models/CommandeFournisseur.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export type StatutCommande = "brouillon" | "envoyee" | "recue_partiellement" | "recue" | "annulee";

export interface ILigneCommande {
  produit:           mongoose.Types.ObjectId;
  nomProduit:        string;
  quantiteCommandee: number;
  quantiteRecue:     number;
  prixUnitaire:      number;
  sousTotal:         number;
}

export interface ICommandeFournisseur extends Document {
  tenantId:     mongoose.Types.ObjectId;
  reference:    string;
  fournisseur:  mongoose.Types.ObjectId;
  destination:  mongoose.Types.ObjectId;
  lignes:       ILigneCommande[];
  montantTotal: number;
  montantPaye:  number;
  montantDu:    number;
  statut:       StatutCommande;
  dateCommande: Date;
  dateLivraison?: Date;
  dateReception?: Date;
  note?:        string;
  createdBy:    mongoose.Types.ObjectId;
  createdAt:    Date;
}

const LigneCommandeSchema = new Schema<ILigneCommande>({
  produit:           { type: Schema.Types.ObjectId, ref: "Produit", required: true },
  nomProduit:        { type: String, required: true },
  quantiteCommandee: { type: Number, required: true, min: 0 },
  quantiteRecue:     { type: Number, default: 0, min: 0 },
  prixUnitaire:      { type: Number, required: true, min: 0 },
  sousTotal:         { type: Number, required: true, min: 0 },
});

const CommandeFournisseurSchema = new Schema<ICommandeFournisseur>(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant",      required: true },
    reference:    { type: String, required: true, unique: true },
    fournisseur:  { type: Schema.Types.ObjectId, ref: "Fournisseur", required: true },
    destination:  { type: Schema.Types.ObjectId, ref: "Boutique",    required: true },
    lignes:       [LigneCommandeSchema],
    montantTotal: { type: Number, required: true, min: 0 },
    montantPaye:  { type: Number, default: 0 },
    montantDu:    { type: Number, default: 0 },
    statut:       { type: String, enum: ["brouillon","envoyee","recue_partiellement","recue","annulee"], default: "brouillon" },
    dateCommande:  { type: Date, default: Date.now },
    dateLivraison: { type: Date, default: null },
    dateReception: { type: Date, default: null },
    note:          { type: String, default: "" },
    createdBy:     { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const CommandeFournisseur: Model<ICommandeFournisseur> =
  mongoose.models.CommandeFournisseur ||
  mongoose.model<ICommandeFournisseur>("CommandeFournisseur", CommandeFournisseurSchema);

export default CommandeFournisseur;
