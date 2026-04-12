// scripts/create-superadmin.ts
// Crée le compte superadmin de la plateforme (toi)
// Usage : npx ts-node scripts/create-superadmin.ts
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/gestopro";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connecté à MongoDB");

  const db = mongoose.connection.db!;

  // Vérifier si le superadmin existe déjà
  const exist = await db.collection("users").findOne({ role: "superadmin", tenantId: null });
  if (exist) {
    console.log("⚠️  Un superadmin plateforme existe déjà :", exist.email);
    await mongoose.disconnect();
    return;
  }

  const hash = await bcrypt.hash("superadmin123", 12);
  await db.collection("users").insertOne({
    tenantId: null,            // NULL = superadmin plateforme
    nom: "Super Admin",
    email: "superadmin@gestopro.com",
    password: hash,
    role: "superadmin",
    boutique: null,
    actif: true,
    createdAt: new Date(),
  });

  console.log("🎉 Superadmin créé !");
  console.log("   Email    : superadmin@gestopro.com");
  console.log("   Password : superadmin123");
  console.log("   URL      : /admin");
  console.log("\n⚠️  Change le mot de passe en production !");

  await mongoose.disconnect();
}

main().catch(console.error);
