// lib/models/ErreurSignalee.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IErreurSignalee extends Document {
  tenantId?:  mongoose.Types.ObjectId;
  userId:     mongoose.Types.ObjectId;
  userNom:    string;
  userRole:   string;
  userEmail:  string;
  page:       string;
  type:       "bug" | "donnees" | "affichage" | "autre";
  description:string;
  statut:     "nouveau" | "en_cours" | "resolu";
  adminNote?: string;
  createdAt:  Date;
  updatedAt:  Date;
}

const schema = new Schema<IErreurSignalee>(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    userId:      { type: Schema.Types.ObjectId, ref: "User",   required: true },
    userNom:     { type: String, required: true },
    userRole:    { type: String, required: true },
    userEmail:   { type: String, required: true },
    page:        { type: String, default: "/" },
    type:        { type: String, enum: ["bug","donnees","affichage","autre"], default: "bug" },
    description: { type: String, required: true, trim: true },
    statut:      { type: String, enum: ["nouveau","en_cours","resolu"], default: "nouveau" },
    adminNote:   { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.ErreurSignalee ||
  mongoose.model<IErreurSignalee>("ErreurSignalee", schema);
