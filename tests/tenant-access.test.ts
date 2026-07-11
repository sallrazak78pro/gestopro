import { describe, it, expect } from "vitest";
import { canAccessBoutique, baseFilter, TenantContext } from "@/lib/utils/tenant";

function ctxAdmin(): TenantContext {
  return { tenantId: "t1", userId: "u1", role: "admin", isSuperAdmin: false, boutiqueAssignee: null };
}
function ctxCaissier(boutiqueId: string): TenantContext {
  return { tenantId: "t1", userId: "u2", role: "caissier", isSuperAdmin: false, boutiqueAssignee: boutiqueId };
}

describe("canAccessBoutique", () => {
  it("grants access to any boutique for a user with no boutique restriction (admin/gestionnaire)", () => {
    expect(canAccessBoutique(ctxAdmin(), "boutique-A")).toBe(true);
    expect(canAccessBoutique(ctxAdmin(), "boutique-B")).toBe(true);
  });

  it("grants a restricted caissier access to their own boutique", () => {
    expect(canAccessBoutique(ctxCaissier("boutique-A"), "boutique-A")).toBe(true);
  });

  it("denies a restricted caissier access to a different boutique (cross-tenant/cross-boutique data isolation)", () => {
    expect(canAccessBoutique(ctxCaissier("boutique-A"), "boutique-B")).toBe(false);
  });
});

describe("baseFilter", () => {
  it("always scopes by tenantId", () => {
    expect(baseFilter(ctxAdmin())).toEqual({ tenantId: "t1" });
  });

  it("does not inject a boutique restriction for an unrestricted user", () => {
    const filter = baseFilter(ctxAdmin());
    expect(filter.boutique).toBeUndefined();
  });

  it("automatically injects the assigned boutique for a restricted caissier", () => {
    expect(baseFilter(ctxCaissier("boutique-A"))).toEqual({ tenantId: "t1", boutique: "boutique-A" });
  });

  it("merges extra filter fields without dropping the boutique restriction", () => {
    const filter = baseFilter(ctxCaissier("boutique-A"), { statut: "payee" });
    expect(filter).toEqual({ tenantId: "t1", statut: "payee", boutique: "boutique-A" });
  });

  it("lets extra fields override tenantId if explicitly passed (documents current behavior)", () => {
    // Pas forcément souhaitable, mais c'est le comportement actuel — un test
    // qui casse ici signale un changement de comportement à vérifier.
    const filter = baseFilter(ctxAdmin(), { tenantId: "override" });
    expect(filter.tenantId).toBe("override");
  });
});
