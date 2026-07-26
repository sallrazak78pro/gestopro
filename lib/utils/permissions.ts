// lib/utils/permissions.ts
// Système de permissions configurables par rôle (Gestionnaire/Caissier).
// Admin et Superadmin ont toujours un accès complet, non configurable — ce
// sont les seuls rôles "métier" restreignables (cf. User.role: admin|
// superadmin|gestionnaire|caissier). Pure logique, sans dépendance serveur,
// pour être importable aussi bien depuis les routes API que depuis le
// layout/la page Paramètres côté client.

export type Action = "view" | "create" | "edit" | "delete";
export type ConfigurableRole = "gestionnaire" | "caissier";

export interface ModuleDef {
  key: string;
  label: string;
  actions: Action[];
}

// Modules du menu + leurs actions pertinentes (une case à cocher par action
// listée ici, les autres n'ont pas de sens pour ce module).
export const MODULES: ModuleDef[] = [
  { key: "ventes",       label: "Ventes",              actions: ["view", "create", "edit"] },
  { key: "marges",       label: "Marges",              actions: ["view"] },
  { key: "stock",        label: "Stock",               actions: ["view", "edit"] },
  { key: "mouvements",   label: "Mouvements",          actions: ["view", "create", "delete"] },
  { key: "tresorerie",   label: "Trésorerie",          actions: ["view"] },
  { key: "versements",   label: "Versements",          actions: ["view", "create", "edit"] },
  { key: "tiers",        label: "Tiers",               actions: ["view", "create", "edit"] },
  { key: "caisse",       label: "Caisse",              actions: ["view", "create", "edit"] },
  { key: "employes",     label: "Employés",            actions: ["view", "create", "edit", "delete"] },
  { key: "fournisseurs", label: "Fournisseurs",        actions: ["view", "create", "edit", "delete"] },
  { key: "commandes",    label: "Commandes",           actions: ["view", "create", "edit"] },
  { key: "salaires",     label: "Salaires",            actions: ["view", "create"] },
  { key: "boutiques",    label: "Boutiques & Dépôts",  actions: ["view", "create", "edit", "delete"] },
  { key: "utilisateurs", label: "Utilisateurs",        actions: ["view", "create", "edit", "delete"] },
  { key: "journal",      label: "Journal d'activité",  actions: ["view"] },
  { key: "parametres",   label: "Paramètres",          actions: ["view", "edit"] },
];

type PermissionMatrix = Record<string, Partial<Record<Action, boolean>>>;

// Valeurs par défaut = comportement actuel du code avant l'introduction de ce
// système (cf. audit dans le plan, vérifié fichier par fichier). Tant qu'un
// admin ne modifie rien depuis Paramètres → Permissions, rien ne change pour
// personne.
export const DEFAULT_PERMISSIONS: Record<ConfigurableRole, PermissionMatrix> = {
  gestionnaire: {
    ventes:       { view: true,  create: true,  edit: true },
    marges:       { view: true },
    stock:        { view: true,  edit: true },
    mouvements:   { view: true,  create: true,  delete: true },
    tresorerie:   { view: true },
    versements:   { view: true,  create: true,  edit: false },
    tiers:        { view: true,  create: true,  edit: true },
    caisse:       { view: true,  create: true,  edit: true },
    employes:     { view: true,  create: false, edit: false, delete: false },
    fournisseurs: { view: false, create: false, edit: false, delete: false },
    commandes:    { view: false, create: true,  edit: true },
    salaires:     { view: false, create: false },
    boutiques:    { view: false, create: false, edit: false, delete: false },
    utilisateurs: { view: false, create: false, edit: false, delete: false },
    journal:      { view: false },
    parametres:   { view: true,  edit: false },
  },
  caissier: {
    ventes:       { view: true,  create: true,  edit: true },
    marges:       { view: false },
    stock:        { view: true,  edit: true },
    mouvements:   { view: true,  create: true,  delete: false },
    tresorerie:   { view: true },
    versements:   { view: true,  create: true,  edit: false },
    tiers:        { view: true,  create: true,  edit: false },
    caisse:       { view: true,  create: true,  edit: true },
    employes:     { view: true,  create: false, edit: false, delete: false },
    fournisseurs: { view: false, create: false, edit: false, delete: false },
    commandes:    { view: false, create: false, edit: false },
    salaires:     { view: false, create: false },
    boutiques:    { view: false, create: false, edit: false, delete: false },
    utilisateurs: { view: false, create: false, edit: false, delete: false },
    journal:      { view: false },
    parametres:   { view: true,  edit: false },
  },
};

function isConfigurableRole(role: string): role is ConfigurableRole {
  return role === "gestionnaire" || role === "caissier";
}

/**
 * Détermine si `role` a le droit d'effectuer `action` sur `module`.
 * Admin/superadmin : toujours autorisés. Gestionnaire/caissier : selon la
 * matrice du tenant (`tenantPermissions`), avec repli sur DEFAULT_PERMISSIONS
 * pour toute case non encore configurée explicitement.
 */
export function hasPermission(
  role: string,
  tenantPermissions: unknown,
  moduleKey: string,
  action: Action
): boolean {
  if (role === "admin" || role === "superadmin") return true;
  if (!isConfigurableRole(role)) return false;

  const tp = (tenantPermissions ?? {}) as Record<string, PermissionMatrix>;
  const override = tp[role]?.[moduleKey]?.[action];
  if (override !== undefined) return override;

  return DEFAULT_PERMISSIONS[role]?.[moduleKey]?.[action] ?? false;
}
