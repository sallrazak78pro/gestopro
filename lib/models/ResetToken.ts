// lib/models/ResetToken.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IResetToken extends Document {
  userId:    mongoose.Types.ObjectId;
  token:     string;
  expiresAt: Date;
  used:      boolean;
}

const ResetTokenSchema = new Schema<IResetToken>({
  userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
  token:     { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
});

// Index TTL — MongoDB supprime automatiquement les tokens expirés
ResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ResetToken: Model<IResetToken> =
  mongoose.models.ResetToken ||
  mongoose.model<IResetToken>("ResetToken", ResetTokenSchema);

export default ResetToken;
