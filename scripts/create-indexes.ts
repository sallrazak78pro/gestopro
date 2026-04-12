// scripts/create-indexes.ts
// Exécuter UNE SEULE FOIS après déploiement :
// MONGODB_URI=... npx ts-node --project tsconfig.json scripts/create-indexes.ts

import mongoose from "mongoose";

async function createIndexes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant dans .env.local");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("DB non connectée");
  console.log("✅ Connecté à MongoDB");

  const indexes: { collection: string; index: Record<string, any>; opts?: Record<string, any> }[] = [

    // ── Ventes ─────────────────────────────────────────────────────────
    { collection: "ventes", index: { tenantId: 1, statut: 1, createdAt: -1 } },
    { collection: "ventes", index: { tenantId: 1, boutique: 1, statut: 1, createdAt: -1 } },
    { collection: "ventes", index: { tenantId: 1, reference: 1 } },
    { collection: "ventes", index: { tenantId: 1, client: 1 } },

    // ── MouvementArgent ────────────────────────────────────────────────
    { collection: "mouvementargents", index: { tenantId: 1, type: 1, createdAt: -1 } },
    { collection: "mouvementargents", index: { tenantId: 1, boutique: 1, type: 1 } },
    { collection: "mouvementargents", index: { tenantId: 1, boutiqueDestination: 1, type: 1 } },
    { collection: "mouvementargents", index: { tenantId: 1, type: 1, statut: 1 } },      // versements
    { collection: "mouvementargents", index: { tenantId: 1, createdAt: -1 } },

    // ── Stock ──────────────────────────────────────────────────────────
    { collection: "stocks", index: { tenantId: 1, boutique: 1 } },
    { collection: "stocks", index: { tenantId: 1, produit: 1, boutique: 1 }, opts: { unique: true } },

    // ── Produits ───────────────────────────────────────────────────────
    { collection: "produits", index: { tenantId: 1, actif: 1, nom: 1 } },
    { collection: "produits", index: { tenantId: 1, categorie: 1 } },
    { collection: "produits", index: { tenantId: 1, reference: 1 } },

    // ── MouvementStock ─────────────────────────────────────────────────
    { collection: "mouvementstocks", index: { tenantId: 1, createdAt: -1 } },
    { collection: "mouvementstocks", index: { tenantId: 1, source: 1, createdAt: -1 } },
    { collection: "mouvementstocks", index: { tenantId: 1, destination: 1, createdAt: -1 } },

    // ── SessionCaisse ──────────────────────────────────────────────────
    { collection: "sessioncaisses", index: { tenantId: 1, boutique: 1, statut: 1 } },
    { collection: "sessioncaisses", index: { tenantId: 1, statut: 1, createdAt: -1 } },

    // ── Employes ───────────────────────────────────────────────────────
    { collection: "employes", index: { tenantId: 1, boutique: 1, actif: 1 } },

    // ── CompteTiers ────────────────────────────────────────────────────
    { collection: "comptetiers", index: { tenantId: 1, type: 1, actif: 1 } },
    { collection: "comptetiers", index: { tenantId: 1, nom: 1 } },

    // ── Fournisseurs ───────────────────────────────────────────────────
    { collection: "fournisseurs", index: { tenantId: 1, actif: 1 } },

    // ── CommandeFournisseur ────────────────────────────────────────────
    { collection: "commandefournisseurs", index: { tenantId: 1, statut: 1, createdAt: -1 } },
    { collection: "commandefournisseurs", index: { tenantId: 1, fournisseur: 1 } },

    // ── Users ──────────────────────────────────────────────────────────
    { collection: "users", index: { tenantId: 1, actif: 1 } },
    { collection: "users", index: { email: 1 }, opts: { unique: true } },

    // ── Boutiques ──────────────────────────────────────────────────────
    { collection: "boutiques", index: { tenantId: 1, type: 1, actif: 1 } },
    { collection: "boutiques", index: { tenantId: 1, estPrincipale: 1 } },

    // ── ActivityLog ────────────────────────────────────────────────────
    { collection: "activitylogs", index: { tenantId: 1, createdAt: -1 } },
    { collection: "activitylogs", index: { tenantId: 1, module: 1, createdAt: -1 } },
    { collection: "activitylogs", index: { tenantId: 1, userId: 1, createdAt: -1 } },

    // ── ResetToken (TTL) ───────────────────────────────────────────────
    { collection: "resettokens", index: { token: 1 }, opts: { unique: true } },
    { collection: "resettokens", index: { expiresAt: 1 }, opts: { expireAfterSeconds: 0 } },

    // ── Tenants ────────────────────────────────────────────────────────
    { collection: "tenants", index: { slug: 1 }, opts: { unique: true } },
    { collection: "tenants", index: { statut: 1 } },
  ];

  let created = 0;
  let skipped = 0;

  for (const { collection, index, opts } of indexes) {
    try {
      await db.collection(collection).createIndex(index, opts ?? {});
      console.log(`  ✅ ${collection} — ${JSON.stringify(index)}`);
      created++;
    } catch (e: any) {
      if (e.code === 85 || e.code === 86) {
        // Index déjà existant avec les mêmes clés
        skipped++;
      } else {
        console.warn(`  ⚠ ${collection} — ${e.message}`);
      }
    }
  }

  console.log(`\n✅ ${created} index créés, ${skipped} déjà existants`);
  await mongoose.disconnect();
}

createIndexes().catch(e => { console.error(e); process.exit(1); });
