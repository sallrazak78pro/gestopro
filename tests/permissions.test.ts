import { describe, it, expect } from "vitest";
import { hasPermission, DEFAULT_PERMISSIONS } from "@/lib/utils/permissions";

describe("hasPermission", () => {
  it("always grants admin and superadmin, regardless of tenantPermissions", () => {
    expect(hasPermission("admin", {}, "utilisateurs", "delete")).toBe(true);
    expect(hasPermission("superadmin", { admin: { utilisateurs: { delete: false } } }, "utilisateurs", "delete")).toBe(true);
  });

  it("falls back to DEFAULT_PERMISSIONS when the tenant hasn't configured anything", () => {
    expect(hasPermission("gestionnaire", {}, "commandes", "create")).toBe(true);
    expect(hasPermission("caissier", {}, "commandes", "create")).toBe(false);
    expect(hasPermission("gestionnaire", undefined, "utilisateurs", "view")).toBe(false);
  });

  it("lets a tenant override a default in either direction", () => {
    const tp = {
      caissier: { commandes: { create: true } },
      gestionnaire: { ventes: { edit: false } },
    };
    expect(hasPermission("caissier", tp, "commandes", "create")).toBe(true);
    expect(hasPermission("gestionnaire", tp, "ventes", "edit")).toBe(false);
    // Cases non touchées par l'override restent sur leur valeur par défaut.
    expect(hasPermission("gestionnaire", tp, "ventes", "view")).toBe(true);
  });

  it("rejects unknown/unconfigurable roles", () => {
    expect(hasPermission("", {}, "ventes", "view")).toBe(false);
    expect(hasPermission("invite", {}, "ventes", "view")).toBe(false);
  });

  it("keeps DEFAULT_PERMISSIONS internally consistent (every module referenced has both roles defined)", () => {
    for (const role of Object.keys(DEFAULT_PERMISSIONS) as (keyof typeof DEFAULT_PERMISSIONS)[]) {
      expect(DEFAULT_PERMISSIONS[role]).toBeTruthy();
    }
  });
});
