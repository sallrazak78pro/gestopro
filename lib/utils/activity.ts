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
  MOUVEMENT_STOCK_CREE: "mouvement_stock_cree",
  // Trésorerie
  MOUVEMENT_CREE: "mouvement_cree",
  VERSEMENT_CREE: "versement_cree",
  VERSEMENT_CONFIRME: "versement_confirme",
  VERSEMENT_REJETE:   "versement_rejete",
  // Utilisateurs
  USER_CREE:      "user_cree",
  USER_MODIFIE:   "user_modifie",
  USER_SUPPRIME:  "user_supprime",
  // Employés
  EMPLOYE_CREE:    "employe_cree",
  EMPLOYE_MODIFIE: "employe_modifie",
  EMPLOYE_SUPPRIME:"employe_supprime",
  AVANCE_CREEE:    "avance_creee",
  SALAIRE_PAYE:    "salaire_paye",
  // Fournisseurs & commandes
  FOURNISSEUR_CREE:   "fournisseur_cree",
  FOURNISSEUR_MODIFIE:"fournisseur_modifie",
  COMMANDE_CREEE:     "commande_creee",
  COMMANDE_PAYEE:     "commande_payee",
  COMMANDE_RECEPTIONNEE: "commande_receptionnee",
  // Comptes tiers
  TIERS_CREE: "tiers_cree",
  // Boutiques
  BOUTIQUE_CREEE:   "boutique_creee",
  BOUTIQUE_MODIFIEE:"boutique_modifiee",
  // Connexion
  CONNEXION:      "connexion",
  DECONNEXION:    "deconnexion",
} as const;

export const MODULES = {
  VENTES:      "ventes",
  CAISSE:      "caisse",
  STOCK:       "stock",
  MOUVEMENTS:  "mouvements",
  TRESORERIE:  "tresorerie",
  VERSEMENTS:  "versements",
  EMPLOYES:    "employes",
  FOURNISSEURS:"fournisseurs",
  COMMANDES:   "commandes",
  TIERS:       "tiers",
  BOUTIQUES:   "boutiques",
  AUTH:        "auth",
  UTILISATEURS:"utilisateurs",
} as const;
