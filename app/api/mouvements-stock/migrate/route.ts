// app/api/mouvements-stock/migrate/route.ts
// Migre les anciens mouvements (schéma produit/quantite/prixUnitaire mono-produit)
// vers le nouveau schéma multi-produits (lignes: []).
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementStock from "@/lib/models/MouvementStock";
import Produit from "@/lib/models/Produit";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Accès refusé" }, { status: 403 });

    await connectDB();

    // ── Cas 1 : ancien schéma source/destination (très ancien) ──────────
    const vieux = await (MouvementStock as any).collection.find({
      tenantId: ctx.tenantId,
      $or: [
        { boutique: { $exists: false } },
        { statut:   { $exists: true  } },
      ],
    }).toArray();

    // ── Cas 2 : nouveau schéma boutique mais encore mono-produit (pas de lignes[]) ──
    const monoProduit = await (MouvementStock as any).collection.find({
      tenantId: ctx.tenantId,
      boutique: { $exists: true },
      produit:  { $exists: true },   // champ mono-produit présent
      lignes:   { $exists: false },  // mais pas encore migré en lignes
    }).toArray();

    const total = vieux.length + monoProduit.length;
    if (total === 0)
      return NextResponse.json({ success: true, message: "Aucun document à migrer.", migrated: 0 });

    const year    = new Date().getFullYear();
    const makeRef = async (tenantId: any) => {
      const n = await MouvementStock.countDocuments({ tenantId });
      return `MV-${year}-${String(n + 1).padStart(4, "0")}`;
    };

    let migrated = 0;
    let deleted  = 0;

    // ── Migrer les très anciens (source/destination) ─────────────────────
    for (const old of vieux) {
      const produitDoc = await Produit.findById(old.produit).lean() as any;
      const prixUnitaire = produitDoc?.prixAchat ?? 0;
      const quantite     = old.quantite ?? 0;
      const montant      = quantite * prixUnitaire;
      const transfertRef = (old.source && old.destination) ? randomUUID() : null;

      await (MouvementStock as any).collection.deleteOne({ _id: old._id });
      deleted++;

      const ligne = { produit: old.produit, quantite, prixUnitaire, montant };

      if (old.type === "entree_fournisseur" && old.destination) {
        await MouvementStock.create({
          tenantId: old.tenantId, reference: await makeRef(old.tenantId),
          boutique: old.destination, type: "entree",
          lignes: [ligne], montant,
          motif: old.motif || "Réception fournisseur (migré)",
          transfertRef: null, createdBy: old.createdBy, createdAt: old.createdAt,
        });
        migrated++;
      } else if (old.type === "sortie_perte" && old.source) {
        await MouvementStock.create({
          tenantId: old.tenantId, reference: await makeRef(old.tenantId),
          boutique: old.source, type: "sortie",
          lignes: [ligne], montant,
          motif: old.motif || "Sortie/Perte (migré)",
          transfertRef: null, createdBy: old.createdBy, createdAt: old.createdAt,
        });
        migrated++;
      } else {
        if (old.source) {
          await MouvementStock.create({
            tenantId: old.tenantId, reference: await makeRef(old.tenantId),
            boutique: old.source, type: "sortie",
            lignes: [ligne], montant,
            motif: old.motif || "Transfert (migré)",
            transfertRef, createdBy: old.createdBy, createdAt: old.createdAt,
          });
          migrated++;
        }
        if (old.destination) {
          await MouvementStock.create({
            tenantId: old.tenantId, reference: await makeRef(old.tenantId),
            boutique: old.destination, type: "entree",
            lignes: [ligne], montant,
            motif: old.motif || "Transfert (migré)",
            transfertRef, createdBy: old.createdBy, createdAt: old.createdAt,
          });
          migrated++;
        }
      }
    }

    // ── Migrer les mono-produits (boutique OK mais pas de lignes[]) ───────
    for (const old of monoProduit) {
      const prixUnitaire = old.prixUnitaire ?? 0;
      const quantite     = old.quantite ?? 0;
      const montant      = old.montant ?? quantite * prixUnitaire;

      const ligne = {
        produit:      old.produit,
        quantite,
        prixUnitaire,
        montant,
      };

      await (MouvementStock as any).collection.updateOne(
        { _id: old._id },
        {
          $set:   { lignes: [ligne], montant },
          $unset: { produit: "", quantite: "", prixUnitaire: "" },
        }
      );
      migrated++;
    }

    return NextResponse.json({
      success: true,
      message: `Migration terminée : ${deleted} ancien(s) reconverti(s), ${migrated} document(s) mis à jour.`,
      deleted,
      migrated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
