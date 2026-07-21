// lib/models/MouvementArgent.ts
import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Types de mouvements d'argent :
 * - versement_boutique : boutique secondaire → boutique principale (collecte)
 * - versement_banque   : boutique principale → banque (dépôt bancaire)
 * - avance_caisse      : boutique principale → boutique secondaire (avance)
 * - remboursement      : boutique secondaire rembourse une avance à la principale
 * - depense            : sortie d'argent d'une boutique (salaire, loyer, divers)
 * - achat_direct       : achat local occasionnel par une boutique secondaire
 * - depot_tiers        : une personne extérieure dépose de l'argent
 * - retrait_tiers      : une personne extérieure retire son argent
 * - ajustement_positif : excédent constaté au comptage réel à la fermeture de caisse
 * - ajustement_negatif : manquant constaté au comptage réel à la fermeture de caisse
 */
export type TypeMouvementArgent =
  | "versement_boutique"
  | "versement_banque"
  | "avance_caisse"
  | "remboursement"
  | "depense"
  | "achat_direct"
  | "depot_tiers"
  | "retrait_tiers"
  | "ajustement_positif"
  | "ajustement_negatif";

export type CategorieDepense = "salaire" | "loyer" | "achat_marchandise" | "divers";

export interface IMouvementArgent extends Document {
  tenantId: mongoose.Types.ObjectId;
  reference: string;
  type: TypeMouvementArgent;
  boutique: mongoose.Types.ObjectId;
  boutiqueDestination?: mongoose.Types.ObjectId;
  montant: number;
  categorieDepense?: CategorieDepense;
  tiers?: mongoose.Types.ObjectId;
  tiersNom?: string;
  motif?: string;
  avanceRef?: string;
  banqueNom?: string;
  commandeId?: mongoose.Types.ObjectId; // lien vers la commande fournisseur payée (si applicable)
  // ── Workflow versement ───────────────────────────
  statut: "confirme" | "en_attente" | "rejete";   // défaut "confirme" pour rétrocompatibilité
  confirmedBy?: mongoose.Types.ObjectId;           // admin qui a validé
  confirmedAt?: Date;
  rejetMotif?: string;
  // ────────────────────────────────────────────────
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MouvementArgentSchema = new Schema<IMouvementArgent>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    reference: { type: String, required: true },
    type: {
      type: String,
      enum: ["versement_boutique","versement_banque","avance_caisse","remboursement","depense","achat_direct","depot_tiers","retrait_tiers","ajustement_positif","ajustement_negatif"],
      required: true,
    },
    boutique: { type: Schema.Types.ObjectId, ref: "Boutique", required: true },
    boutiqueDestination: { type: Schema.Types.ObjectId, ref: "Boutique", default: null },
    montant: { type: Number, required: true, min: 1 },
    categorieDepense: {
      type: String,
      enum: ["salaire", "loyer", "achat_marchandise", "divers"],
      default: null,
    },
    banqueNom: { type: String, default: "" },   // pour versement_banque
    tiers: { type: Schema.Types.ObjectId, ref: "CompteTiers", default: null },
    tiersNom: { type: String, default: "" },
    motif:    { type: String, default: "" },
    avanceRef:{ type: String, default: "" },
    commandeId: { type: Schema.Types.ObjectId, ref: "CommandeFournisseur", default: null },
    // Workflow versement
    statut:       { type: String, enum: ["confirme","en_attente","rejete"], default: "confirme" },
    confirmedBy:  { type: Schema.Types.ObjectId, ref: "User", default: null },
    confirmedAt:  { type: Date, default: null },
    rejetMotif:   { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

MouvementArgentSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
// Sert les agrégations de solde de caisse (dashboard, trésorerie), filtrées
// par tenant + boutique + type à chaque chargement de page.
MouvementArgentSchema.index({ tenantId: 1, boutique: 1, type: 1 });
MouvementArgentSchema.index({ tenantId: 1, boutiqueDestination: 1, type: 1, statut: 1 });

const MouvementArgent: Model<IMouvementArgent> =
  mongoose.models.MouvementArgent ||
  mongoose.model<IMouvementArgent>("MouvementArgent", MouvementArgentSchema);

export default MouvementArgent;
