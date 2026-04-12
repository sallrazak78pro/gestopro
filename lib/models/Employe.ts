// lib/models/Employe.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmploye extends Document {
  tenantId: mongoose.Types.ObjectId;
  boutique: mongoose.Types.ObjectId;       // boutique fixe
  userId?: mongoose.Types.ObjectId | null; // lien optionnel vers un compte User

  // Infos personnelles
  nom: string;
  prenom: string;
  telephone?: string;
  adresse?: string;
  cni?: string;                            // numéro de pièce d'identité

  // Infos professionnelles
  poste: string;                           // ex: Caissier, Gestionnaire, Livreur...
  dateEmbauche: Date;
  salaireBase: number;                     // salaire mensuel brut de référence

  actif: boolean;
  createdAt: Date;
}

const EmployeSchema = new Schema<IEmploye>(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant",   required: true },
    boutique:     { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    userId:       { type: Schema.Types.ObjectId, ref: "User",     default: null },

    nom:          { type: String, required: true, trim: true },
    prenom:       { type: String, required: true, trim: true },
    telephone:    { type: String, default: "" },
    adresse:      { type: String, default: "" },
    cni:          { type: String, default: "" },

    poste:        { type: String, required: true, trim: true },
    dateEmbauche: { type: Date, required: true },
    salaireBase:  { type: Number, required: true, min: 0 },

    actif:        { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Employe: Model<IEmploye> =
  mongoose.models.Employe || mongoose.model<IEmploye>("Employe", EmployeSchema);

export default Employe;
