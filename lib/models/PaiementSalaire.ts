// lib/models/PaiementSalaire.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPaiementSalaire extends Document {
  tenantId:    mongoose.Types.ObjectId;
  employe:     mongoose.Types.ObjectId;
  boutique:    mongoose.Types.ObjectId;

  // Période payée
  mois:        number;   // 1-12
  annee:       number;

  // Montants
  salaireBase:       number;   // snapshot du salaire de base au moment du paiement
  totalAvances:      number;   // somme des avances déduites ce mois
  montantNet:        number;   // salaireBase - totalAvances

  // Avances déduites (liste des IDs)
  avancesDeduits: mongoose.Types.ObjectId[];

  // Paiement
  datePaiement: Date;
  modePaiement: "especes" | "mobile_money" | "virement";
  boutiqueSource: mongoose.Types.ObjectId;   // caisse d'où sort l'argent
  note?: string;

  // Référence vers le mouvement de trésorerie créé automatiquement
  mouvementArgentId?: mongoose.Types.ObjectId | null;

  createdBy:  mongoose.Types.ObjectId;
  reference:  string;
  createdAt:  Date;
}

const PaiementSalaireSchema = new Schema<IPaiementSalaire>(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant",   required: true },
    employe:     { type: Schema.Types.ObjectId, ref: "Employe",  required: true },
    boutique:    { type: Schema.Types.ObjectId, ref: "Boutique", required: true },

    mois:        { type: Number, required: true, min: 1, max: 12 },
    annee:       { type: Number, required: true },

    salaireBase:  { type: Number, required: true },
    totalAvances: { type: Number, default: 0 },
    montantNet:   { type: Number, required: true },

    avancesDeduits:  [{ type: Schema.Types.ObjectId, ref: "AvanceSalaire" }],

    datePaiement: { type: Date, default: Date.now },
    modePaiement: {
      type: String,
      enum: ["especes", "mobile_money", "virement"],
      default: "especes",
    },
    boutiqueSource: { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    note:           { type: String, default: "" },

    mouvementArgentId: { type: Schema.Types.ObjectId, ref: "MouvementArgent", default: null },
    createdBy:         { type: Schema.Types.ObjectId, ref: "User", required: true },
    reference:         { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

// Un seul paiement par employé par mois/année
PaiementSalaireSchema.index({ employe: 1, mois: 1, annee: 1 }, { unique: true });

const PaiementSalaire: Model<IPaiementSalaire> =
  mongoose.models.PaiementSalaire ||
  mongoose.model<IPaiementSalaire>("PaiementSalaire", PaiementSalaireSchema);

export default PaiementSalaire;
