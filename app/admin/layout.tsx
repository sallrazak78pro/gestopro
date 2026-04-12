// app/admin/layout.tsx
"use client";
import React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";

const NAV = [
  { href: "/admin",             icon: "⚡", label: "Dashboard" },
  { href: "/admin/entreprises", icon: "🏢", label: "Entreprises" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated") {
      const role     = (session?.user as any)?.role;
      const tenantId = (session?.user as any)?.tenantId;
      if (role !== "superadmin" || tenantId) router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted font-mono text-sm animate-pulse">Chargement...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex"
      style={{ background: "var(--color-bg)" }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col border-r"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white text-base shrink-0"
              style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)" }}>
              G
            </div>
            <div>
              <p className="font-extrabold text-sm" style={{ color: "var(--color-fg)" }}>GestoPro</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-danger">Super Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => {
            const active = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted2 hover:bg-white/[0.04] hover:text-fg"
                )}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
              style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)" }}>
              {session?.user?.name?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--color-fg)" }}>
                {session?.user?.name}
              </p>
              <p className="text-[10px] font-mono text-danger uppercase">Plateforme</p>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              title="Déconnexion"
              className="text-muted hover:text-danger transition-colors text-sm">
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenu ──────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
