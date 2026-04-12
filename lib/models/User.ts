// lib/models/User.ts
import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  tenantId: mongoose.Types.ObjectId | null;
  nom: string;
  prenom: string;
  email: string;
  password: string;
  telephone?: string;
  role: "superadmin" | "admin" | "gestionnaire" | "caissier";
  boutique?: mongoose.Types.ObjectId;
  actif: boolean;
  createdAt: Date;
  comparePassword(candidat: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    nom:       { type: String, required: true, trim: true },
    prenom:    { type: String, default: "", trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true },
    telephone: { type: String, default: "" },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["superadmin", "admin", "gestionnaire", "caissier"],
      default: "caissier",
    },
    boutique: { type: Schema.Types.ObjectId, ref: "Boutique", default: null },
    actif:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidat: string) {
  return bcrypt.compare(candidat, this.password);
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
