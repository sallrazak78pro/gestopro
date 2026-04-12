// lib/utils/activity.ts
import ActivityLog from "@/lib/models/ActivityLog";

export async function logActivity({
  tenantId, userId, userNom, role, action, module, details, reference, boutique, ip,
}: {
  tenantId: string;
  userId: string;
  userNom: string;
  role: string;
  action: string;
  module: string;
  details: string;
  reference?: string;
  boutique?: string;
  ip?: string;
}) {
  try {
    await ActivityLog.create({
      tenantId, userId, userNom, role, action, module, details,
      reference: reference ?? "",
      boutique:  boutique  ?? null,
      ip:        ip        ?? "",
    });
  } catch {
    // Le log d'activité ne doit jamais faire échouer l'opération principale
  }
}

export const ACTIONS = {
  // Ventes
  VENTE_CREEE:    "vente_creee",
  VENTE_ANNULEE:  "vente_annulee",
  VENTE_ENCAISSEE:"vente_encaissee",
  // Caisse
  CAISSE_OUVERTE: "caisse_ouverte",
  CAISSE_FERMEE:  "caisse_fermee",
  // Stock
  STOCK_AJUSTE:   "stock_ajuste",
  PRODUIT_CREE:   "produit_cree",
  PRODUIT_MODIFIE:"produit_modifie",
  PRODUIT_SUPPRIME:"produit_supprime",
  // Trésorerie
  MOUVEMENT_CREE: "mouvement_cree",
  // Utilisateurs
  USER_CREE:      "user_cree",
  USER_MODIFIE:   "user_modifie",
  USER_SUPPRIME:  "user_supprime",
  // Connexion
  CONNEXION:      "connexion",
} as const;

export const MODULES = {
  VENTES:     "ventes",
  CAISSE:     "caisse",
  STOCK:      "stock",
  TRESORERIE: "tresorerie",
  EMPLOYES:   "employes",
  AUTH:       "auth",
  UTILISATEURS:"utilisateurs",
} as const;
