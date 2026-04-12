// lib/models/SessionCaisse.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISessionCaisse extends Document {
  tenantId: mongoose.Types.ObjectId;
  boutique: mongoose.Types.ObjectId;
  ouvertPar: mongoose.Types.ObjectId;
  ferméPar?: mongoose.Types.ObjectId;
  reference?: string;

  // Ouverture
  dateOuverture: Date;
  fondOuverture: number;        // montant saisi manuellement à l'ouverture
  noteOuverture?: string;

  // Fermeture
  dateFermeture?: Date;
  statut: "ouverte" | "fermee";

  // Montants calculés à la fermeture (snapshot)
  totalVentes: number;          // total des ventes payées pendant la session
  totalEntrees: number;         // versements reçus + avances reçues + dépôts tiers
  totalSorties: number;         // dépenses + versements faits + retraits tiers
  montantAttendu: number;       // fondOuverture + totalVentes + totalEntrees - totalSorties

  // Détail par mode de paiement (ventes)
  ventesEspeces: number;
  ventesMobileMoney: number;
  ventesVirement: number;
  ventesCheque: number;

  // Comptage réel saisi par l'utilisateur à la fermeture
  montantReelEspeces: number;
  montantReelMobileMoney: number;
  montantReelVirement: number;
  montantReelCheque: number;
  montantReelTotal: number;     // somme des 4 précédents

  ecart: number;                // montantReelTotal - montantAttendu
  noteFermeture?: string;
}

const SessionCaisseSchema = new Schema<ISessionCaisse>(
  {
    tenantId:  { type: Schema.Types.ObjectId, ref: "Tenant",  required: true },
    boutique:  { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    ouvertPar: { type: Schema.Types.ObjectId, ref: "User",    required: true },
    ferméPar:  { type: Schema.Types.ObjectId, ref: "User",    default: null },
    reference: { type: String, default: "" },

    dateOuverture: { type: Date, default: Date.now },
    fondOuverture: { type: Number, default: 0, min: 0 },
    noteOuverture: { type: String, default: "" },

    dateFermeture: { type: Date, default: null },
    statut: { type: String, enum: ["ouverte", "fermee"], default: "ouverte" },

    totalVentes:   { type: Number, default: 0 },
    totalEntrees:  { type: Number, default: 0 },
    totalSorties:  { type: Number, default: 0 },
    montantAttendu:{ type: Number, default: 0 },

    ventesEspeces:      { type: Number, default: 0 },
    ventesMobileMoney:  { type: Number, default: 0 },
    ventesVirement:     { type: Number, default: 0 },
    ventesCheque:       { type: Number, default: 0 },

    montantReelEspeces:     { type: Number, default: 0 },
    montantReelMobileMoney: { type: Number, default: 0 },
    montantReelVirement:    { type: Number, default: 0 },
    montantReelCheque:      { type: Number, default: 0 },
    montantReelTotal:       { type: Number, default: 0 },

    ecart:          { type: Number, default: 0 },
    noteFermeture:  { type: String, default: "" },
  },
  { timestamps: true }
);

// Index pour trouver rapidement la session ouverte d'une boutique
SessionCaisseSchema.index({ boutique: 1, statut: 1 });

const SessionCaisse: Model<ISessionCaisse> =
  mongoose.models.SessionCaisse ||
  mongoose.model<ISessionCaisse>("SessionCaisse", SessionCaisseSchema);

export default SessionCaisse;
