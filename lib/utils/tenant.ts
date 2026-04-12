// lib/utils/tenant.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
  isSuperAdmin: boolean;
  // Si non-null : l'utilisateur est restreint à cette boutique uniquement
  boutiqueAssignee: string | null;
}

export async function getTenantContext(): Promise<
  { ctx: TenantContext; error: null } | { ctx: null; error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ctx: null, error: NextResponse.json({ success: false, message: "Non authentifié" }, { status: 401 }) };
  }

  const user = session.user as any;
  const isSuperAdmin = user.role === "superadmin" && !user.tenantId;

  // Le superadmin n'a accès qu'aux APIs /admin — bloqué sur toutes les autres
  if (isSuperAdmin) {
    return { ctx: null, error: NextResponse.json({
      success: false,
      message: "Accès refusé. Le Super Admin n'a pas accès aux données des entreprises.",
    }, { status: 403 }) };
  }

  if (!user.tenantId) {
    return { ctx: null, error: NextResponse.json({ success: false, message: "Tenant introuvable" }, { status: 403 }) };
  }

  // Vérifier que le tenant est actif (sauf superadmin)
  if (!isSuperAdmin && user.tenantId) {
    const { connectDB } = await import("@/lib/mongodb");
    const Tenant = (await import("@/lib/models/Tenant")).default;
    await connectDB();
    const tenant = await Tenant.findById(user.tenantId).lean() as any;
    if (tenant?.statut === "suspendu") {
      return { ctx: null, error: NextResponse.json({
        success: false,
        message: "Votre compte a été suspendu. Contactez l'administrateur.",
        code: "TENANT_SUSPENDED",
      }, { status: 403 }) };
    }
  }

  // boutiqueAssignee = la boutique spécifique assignée au user (null = accès global)
  // Admin/superadmin/gestionnaire → accès global (toutes les boutiques)
  // Caissier → restreint à sa boutique assignée uniquement
  const boutiqueAssignee =
    ["admin", "superadmin", "gestionnaire"].includes(user.role)
      ? null
      : (user.boutique ?? null);

  return {
    ctx: {
      tenantId: user.tenantId ?? null,
      userId: user.id,
      role: user.role,
      isSuperAdmin,
      boutiqueAssignee,
    },
    error: null,
  };
}

/**
 * Retourne le filtre MongoDB de base pour toutes les queries.
 * Si l'utilisateur est restreint à une boutique, le filtre est injecté automatiquement.
 */
export function baseFilter(ctx: TenantContext, extra?: Record<string, any>) {
  const filter: any = { tenantId: ctx.tenantId, ...extra };
  // Si l'utilisateur a une boutique assignée, restreindre les données à cette boutique
  if (ctx.boutiqueAssignee) {
    filter.boutique = ctx.boutiqueAssignee;
  }
  return filter;
}

/**
 * Vérifie si un utilisateur a le droit d'accéder à une boutique spécifique.
 */
export function canAccessBoutique(ctx: TenantContext, boutiqueId: string): boolean {
  if (!ctx.boutiqueAssignee) return true; // accès global
  return ctx.boutiqueAssignee === boutiqueId;
}

/**
 * Contexte réservé aux APIs /admin — uniquement pour le superadmin plateforme.
 */
export async function getSuperAdminContext(): Promise<
  { userId: string; error: null } | { userId: null; error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { userId: null, error: NextResponse.json({ success: false, message: "Non authentifié" }, { status: 401 }) };
  }
  const user = session.user as any;
  const isSuperAdmin = user.role === "superadmin" && !user.tenantId;
  if (!isSuperAdmin) {
    return { userId: null, error: NextResponse.json({ success: false, message: "Accès réservé au Super Admin." }, { status: 403 }) };
  }
  return { userId: user.id, error: null };
}
