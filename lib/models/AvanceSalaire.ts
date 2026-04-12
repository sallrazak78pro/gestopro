// lib/models/AvanceSalaire.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAvanceSalaire extends Document {
  tenantId:  mongoose.Types.ObjectId;
  employe:   mongoose.Types.ObjectId;
  boutique:  mongoose.Types.ObjectId;

  montant:   number;
  motif?:    string;
  date:      Date;

  // Déduction : sur quel mois cette avance sera déduite
  moisDeduction:  number;   // 1-12
  anneeDeduction: number;

  // Statut : "en_attente" = pas encore déduite, "deduite" = déjà déduite du salaire
  statut: "en_attente" | "deduite";

  // Référence au paiement de salaire qui l'a déduite
  paiementSalaireId?: mongoose.Types.ObjectId | null;

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const AvanceSalaireSchema = new Schema<IAvanceSalaire>(
  {
    tenantId:  { type: Schema.Types.ObjectId, ref: "Tenant",   required: true },
    employe:   { type: Schema.Types.ObjectId, ref: "Employe",  required: true },
    boutique:  { type: Schema.Types.ObjectId, ref: "Boutique", required: true },

    montant:   { type: Number, required: true, min: 1 },
    motif:     { type: String, default: "" },
    date:      { type: Date, default: Date.now },

    moisDeduction:  { type: Number, required: true, min: 1, max: 12 },
    anneeDeduction: { type: Number, required: true },

    statut: {
      type: String,
      enum: ["en_attente", "deduite"],
      default: "en_attente",
    },
    paiementSalaireId: { type: Schema.Types.ObjectId, ref: "PaiementSalaire", default: null },
    createdBy:         { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const AvanceSalaire: Model<IAvanceSalaire> =
  mongoose.models.AvanceSalaire ||
  mongoose.model<IAvanceSalaire>("AvanceSalaire", AvanceSalaireSchema);

export default AvanceSalaire;
