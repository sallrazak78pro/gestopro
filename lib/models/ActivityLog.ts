// lib/models/ActivityLog.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActivityLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId:   mongoose.Types.ObjectId;
  userNom:  string;
  role:     string;
  action:   string; // "vente_creee" | "vente_annulee" | "connexion" | etc.
  module:   string; // "ventes" | "stock" | "caisse" | etc.
  details:  string; // description lisible
  reference?: string;
  boutique?: mongoose.Types.ObjectId;
  ip?: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    tenantId:  { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    userId:    { type: Schema.Types.ObjectId, ref: "User",   required: true },
    userNom:   { type: String, default: "" },
    role:      { type: String, default: "" },
    action:    { type: String, required: true },
    module:    { type: String, required: true },
    details:   { type: String, default: "" },
    reference: { type: String, default: "" },
    boutique:  { type: Schema.Types.ObjectId, ref: "Boutique", default: null },
    ip:        { type: String, default: "" },
  },
  { timestamps: true }
);

// Index pour performance — logs sont souvent triés par date
ActivityLogSchema.index({ tenantId: 1, createdAt: -1 });
ActivityLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
ActivityLogSchema.index({ tenantId: 1, module: 1, createdAt: -1 });

const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);

export default ActivityLog;
