// scripts/seed.ts
// Lance avec : npx ts-node scripts/seed.ts
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/gestopro";

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connecté à MongoDB");

  const db = mongoose.connection.db!;

  // ── Boutiques ─────────────────────────────────────────────
  await db.collection("boutiques").deleteMany({});
  const boutiques = await db.collection("boutiques").insertMany([
    { nom: "Dépôt Central",  type: "depot",    estPrincipale: false, actif: true, createdAt: new Date() },
    { nom: "PDV Plateau",    type: "boutique", estPrincipale: true,  actif: true, createdAt: new Date() },
    { nom: "PDV Cocody",     type: "boutique", estPrincipale: false, actif: true, createdAt: new Date() },
    { nom: "PDV Yopougon",   type: "boutique", estPrincipale: false, actif: true, createdAt: new Date() },
  ]);
  console.log("✅ Boutiques créées");

  // ── Superadmin ────────────────────────────────────────────
  await db.collection("users").deleteMany({});
  const hash = await bcrypt.hash("admin123", 12);
  await db.collection("users").insertOne({
    nom: "Super Admin",
    email: "admin@gestopro.com",
    password: hash,
    role: "superadmin",
    boutique: null,
    actif: true,
    createdAt: new Date(),
  });
  console.log("✅ Superadmin créé — email: admin@gestopro.com / mdp: admin123");

  // ── Produits exemple ──────────────────────────────────────
  await db.collection("produits").deleteMany({});
  await db.collection("produits").insertMany([
    { reference: "PRD-001", nom: "Smartphone X12",     categorie: "Électronique", prixAchat: 120000, prixVente: 180000, seuilAlerte: 5, unite: "pièce", actif: true },
    { reference: "PRD-002", nom: "Écouteurs BT Pro",   categorie: "Électronique", prixAchat: 15000,  prixVente: 25000,  seuilAlerte: 10, unite: "pièce", actif: true },
    { reference: "PRD-003", nom: "Chargeur USB-C 65W", categorie: "Accessoires",  prixAchat: 5000,   prixVente: 9500,   seuilAlerte: 15, unite: "pièce", actif: true },
  ]);
  console.log("✅ Produits créés");

  await mongoose.disconnect();
  console.log("🎉 Seed terminé !");
}

seed().catch(console.error);
