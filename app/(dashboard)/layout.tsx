// app/(dashboard)/layout.tsx
"use client";
import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import NotificationPanel from "@/components/ui/NotificationPanel";
import ThemeToggle from "@/components/ui/ThemeToggle";
import GlobalSearch from "@/components/ui/GlobalSearch";

const NAV = [
  { href: "/dashboard",   icon: "⚡", label: "Tableau de bord",        roles: ["superadmin","admin","gestionnaire","caissier"] },
  { href: "/alertes",     icon: "🔔", label: "Alertes",                roles: ["superadmin","admin","gestionnaire","caissier"], alertKey: "alertes" },
  { href: "/ventes",      icon: "🧾", label: "Ventes",                 roles: ["superadmin","admin","gestionnaire","caissier"] },
  { href: "/marges",      icon: "📊", label: "Marges",                  roles: ["admin","gestionnaire"] },
  { href: "/stock",       icon: "📦", label: "Stock",                  roles: ["superadmin","admin","gestionnaire","caissier"], alertKey: "stock" },
  { href: "/mouvements",  icon: "🔄", label: "Mouvements",             roles: ["superadmin","admin","gestionnaire","caissier"] },
  { href: "/tresorerie",  icon: "💳", label: "Trésorerie",             roles: ["superadmin","admin","gestionnaire","caissier"] },
  { href: "/versements",  icon: "💸", label: "Versements",             roles: ["admin","gestionnaire","caissier"], alertKey: "versements" },
  { href: "/tiers",       icon: "👥", label: "Tiers",                  roles: ["superadmin","admin","gestionnaire","caissier"] },
  { href: "/caisse",      icon: "🏧", label: "Caisse",                 roles: ["superadmin","admin","gestionnaire","caissier"], alertKey: "caisse" },
  { href: "/employes",    icon: "👷", label: "Employés",               roles: ["superadmin","admin","gestionnaire","caissier"] },
  { href: "/fournisseurs",icon: "🏭", label: "Fournisseurs",           roles: ["superadmin","admin"] },
  { href: "/commandes",   icon: "🛒", label: "Commandes",              roles: ["superadmin","admin"], alertKey: "commandes" },
  { href: "/salaires",    icon: "💼", label: "Salaires",               roles: ["superadmin","admin"] },
];

const ADMIN_NAV = [
  { href: "/boutiques",    icon: "🏪", label: "Boutiques & Dépôts" },
  { href: "/utilisateurs", icon: "👤", label: "Utilisateurs" },
  { href: "/activite",     icon: "📋", label: "Journal d'activité" },
  { href: "/parametres",   icon: "⚙️", label: "Paramètres" },
];

// Nav raccourci pour la barre mobile (5 items max)
const MOBILE_NAV = [
  { href: "/dashboard",  icon: "⚡", label: "Dashboard" },
  { href: "/ventes",     icon: "🧾", label: "Ventes" },
  { href: "/caisse",     icon: "🏧", label: "Caisse" },
  { href: "/stock",      icon: "📦", label: "Stock" },
  { href: "/tresorerie", icon: "💳", label: "Tréso" },
];

const ALL_NAV = [...NAV, ...ADMIN_NAV];
const PDV_COLORS = ["#00d4ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444"];

function navBadge(alertKey: string | undefined, notifications: any[]): number {
  if (!alertKey) return 0;
  if (alertKey === "alertes")   return notifications.length;
  if (alertKey === "stock")     return notifications.filter(n => ["rupture","stock_faible"].includes(n.type)).length;
  if (alertKey === "caisse")    return notifications.filter(n => n.type === "session_ouverte").length;
  if (alertKey === "commandes") return notifications.filter(n => ["commande_en_attente","commande_a_payer"].includes(n.type)).length;
  if (alertKey === "versements") return notifications.filter(n => n.type === "versement_en_attente").length;
  return 0;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session }   = useSession();
  const pathname            = usePathname();
  const router              = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop,   setIsDesktop]   = useState(true);
  const [boutiques,   setBoutiques]   = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen,  setNotifOpen]    = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [mouvementsActifs, setMouvementsActifs] = useState(true);
  const bellRef = useRef<HTMLDivElement>(null);

  const role    = (session?.user as any)?.role ?? "";
  const isAdmin = role === "superadmin" || role === "admin";

  // Filtrer la nav selon le rôle ET les paramètres
  const visibleNav = NAV.filter(item => {
    if (!item.roles.includes(role)) return false;
    if (item.href === "/mouvements" && !mouvementsActifs) return false;
    return true;
  });

  // Détecter desktop/mobile
  useEffect(() => {
    const check = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      setSidebarOpen(desktop);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fermer sidebar sur navigation mobile
  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false);
  }, [pathname, isDesktop]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res  = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) setNotifications(json.data);
    } catch {}
    setNotifLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/boutiques")
      .then(r => r.json())
      .then(j => j.success && setBoutiques(j.data.filter((b: any) => b.type === "boutique")))
      .catch(() => {});
    // Charger les paramètres du tenant pour savoir si mouvements est actif
    fetch("/api/parametres")
      .then(r => r.json())
      .then(j => { if (j.success) setMouvementsActifs(j.data.mouvementsActifs ?? true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const nbDanger  = notifications.filter(n => n.severity === "danger").length;
  const nbWarning = notifications.filter(n => n.severity === "warning").length;
  const nbTotal   = notifications.length;
  const bellColor = nbDanger > 0 ? "text-danger" : nbWarning > 0 ? "text-warning" : "text-muted";
  const badgeBg   = nbDanger > 0 ? "bg-danger"   : nbWarning > 0 ? "bg-warning"   : "bg-accent";

  const currentLabel = ALL_NAV.find(n =>
    pathname === n.href || pathname.startsWith(n.href + "/")
  )?.label ?? "GestoPro";

  const NavLink = ({ item, onClick }: { item: any; onClick?: () => void; [k: string]: any }) => {
    const active  = pathname === item.href || pathname.startsWith(item.href + "/");
    const badgeNb = navBadge((item as any).alertKey, notifications);
    return (
      <Link href={item.href} onClick={onClick}
        className={clsx(
          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium",
          "border transition-all duration-200",
          active
            ? "bg-gradient-surface text-accent border-border2"
            : "text-muted2 border-transparent hover:bg-white/5 hover:text-fg"
        )}>
        <span className="text-base w-5 shrink-0 text-center">{item.icon}</span>
        <span className="flex-1 truncate">{item.label}</span>
        {badgeNb > 0 && (
          <span className={clsx("text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono shrink-0",
            (item as any).alertKey === "stock" && notifications.filter(n => n.type === "rupture").length > 0
              ? "bg-danger animate-pulse" : "bg-warning")}>
            {badgeNb}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border shrink-0">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-accent flex items-center justify-center text-base font-extrabold text-white shadow-accent">G</div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-extrabold tracking-tight truncate">GestoPro</div>
          <div className="text-[10px] font-mono text-muted tracking-[0.15em]">ERP · v2.0</div>
        </div>
        {/* Bouton fermer sur mobile */}
        <button onClick={() => setSidebarOpen(false)}
          className="md:hidden text-muted hover:text-fg text-xl ml-auto">✕</button>
      </div>

      {/* Nav scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        <p className="text-[9px] font-mono text-muted uppercase tracking-[0.2em] px-3 pb-2">Navigation</p>

        {visibleNav.map(item => (
          <NavLink key={item.href} item={item} onClick={() => { if (!isDesktop) setSidebarOpen(false); }} />
        ))}

        {isAdmin && (
          <>
            <div className="divider" />
            <p className="text-[9px] font-mono text-muted uppercase tracking-[0.2em] px-3 pb-2">Administration</p>
            {ADMIN_NAV.map(item => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  onClick={() => { if (!isDesktop) setSidebarOpen(false); }}
                  className={clsx(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200",
                    active ? "bg-gradient-surface text-accent border-border2" : "text-muted2 border-transparent hover:bg-white/5 hover:text-fg"
                  )}>
                  <span className="text-base w-5 shrink-0 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}

        {/* PDV rapides */}
        {boutiques.length > 0 && (
          <>
            <div className="divider" />
            <p className="text-[9px] font-mono text-muted uppercase tracking-[0.2em] px-3 pb-2">Points de vente</p>
            {boutiques.map((b, i) => (
              <div key={b._id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted2 hover:text-fg hover:bg-white/5 cursor-pointer transition-colors">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PDV_COLORS[i % PDV_COLORS.length] }} />
                <span className="truncate">{b.nom}</span>
                {b.estPrincipale && <span className="ml-auto text-[9px] font-mono text-accent opacity-70">★</span>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* User card */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2.5 bg-surface2 rounded-xl px-3 py-2.5">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-accent flex items-center justify-center text-xs font-bold text-white cursor-pointer"
            onClick={() => { router.push("/profil"); if (!isDesktop) setSidebarOpen(false); }}>
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { router.push("/profil"); if (!isDesktop) setSidebarOpen(false); }}>
            <div className="text-xs font-semibold truncate" style={{ color: "var(--color-fg)" }}>{session?.user?.name}</div>
            <div className="text-[10px] font-mono text-muted uppercase">{role}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-muted hover:text-danger transition-colors text-sm" title="Déconnexion">⏻</button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-bg">

      {/* ── OVERLAY MOBILE ─────────────────────────── */}
      {sidebarOpen && !isDesktop && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR DESKTOP (statique) ───────────────── */}
      <aside className={clsx(
        "hidden md:flex flex-col bg-surface border-r border-border",
        "fixed left-0 top-0 bottom-0 z-50 transition-all duration-300",
        sidebarOpen ? "w-60" : "w-16"
      )}>
        {/* Version desktop compacte si fermée */}
        {!sidebarOpen ? (
          <>
            <div className="flex items-center justify-center py-5 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center text-base font-extrabold text-white">G</div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
              {visibleNav.map(item => {
                const active  = pathname === item.href || pathname.startsWith(item.href + "/");
                const badgeNb = navBadge((item as any).alertKey, notifications);
                return (
                  <Link key={item.href} href={item.href}
                    className={clsx("flex items-center justify-center p-2.5 rounded-xl relative transition-all",
                      active ? "bg-accent/10 text-accent" : "text-muted2 hover:bg-white/5 hover:text-fg")}>
                    <span className="text-lg">{item.icon}</span>
                    {badgeNb > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />}
                  </Link>
                );
              })}
              {isAdmin && ADMIN_NAV.map(item => (
                <Link key={item.href} href={item.href}
                  className={clsx("flex items-center justify-center p-2.5 rounded-xl transition-all",
                    pathname === item.href ? "bg-accent/10 text-accent" : "text-muted2 hover:bg-white/5 hover:text-fg")}>
                  <span className="text-lg">{item.icon}</span>
                </Link>
              ))}
            </div>
            <div className="p-2 border-t border-border">
              <div className="flex justify-center py-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center text-xs font-bold text-white cursor-pointer"
                  onClick={() => router.push("/profil")}>
                  {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
                </div>
              </div>
            </div>
            {/* Toggle */}
            <button onClick={() => setSidebarOpen(true)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface border border-border text-muted hover:text-fg text-xs flex items-center justify-center">
              ▶
            </button>
          </>
        ) : (
          <>
            {sidebarContent}
            <button onClick={() => setSidebarOpen(false)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface border border-border text-muted hover:text-fg text-xs flex items-center justify-center">
              ◀
            </button>
          </>
        )}
      </aside>

      {/* ── SIDEBAR MOBILE (drawer) ───────────────────── */}
      <aside className={clsx(
        "md:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-surface border-r border-border w-72",
        "transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </aside>

      {/* ── CONTENU PRINCIPAL ────────────────────────── */}
      <div className={clsx(
        "flex-1 flex flex-col min-h-screen transition-all duration-300",
        "md:ml-60",
        !sidebarOpen && "md:ml-16"
      )}>

        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-surface border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center gap-3">

          {/* Hamburger mobile */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-muted hover:text-fg text-xl p-1 rounded-lg hover:bg-white/5">
            ☰
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-xl font-extrabold tracking-tight truncate" style={{ color: "var(--color-fg)" }}>
              {currentLabel}
            </h1>
            <p className="hidden sm:block text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GlobalSearch />
            <ThemeToggle />

            {/* Cloche notifications */}
            <div ref={bellRef} className="relative">
              <button onClick={() => { fetchNotifications(); setNotifOpen(!notifOpen); }}
                className={clsx("relative p-2 rounded-xl hover:bg-white/5 transition-colors text-lg", bellColor)}>
                🔔
                {nbTotal > 0 && (
                  <span className={clsx("absolute -top-0.5 -right-0.5 text-[9px] text-white font-bold font-mono px-1 py-0.5 rounded-full min-w-[16px] text-center", badgeBg)}>
                    {nbTotal}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotificationPanel
                  notifications={notifications}
                  loading={notifLoading}
                  onClose={() => setNotifOpen(false)}
                  anchorRef={bellRef}
                />
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* ── BARRE DE NAV MOBILE (bottom) ─────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border">
        <div className="flex items-center justify-around px-2 py-2">
          {MOBILE_NAV.filter(item => {
            const navItem = NAV.find(n => n.href === item.href);
            if (!navItem) return true;
            if (!navItem.roles.includes(role)) return false;
            if (item.href === "/mouvements" && !mouvementsActifs) return false;
            return true;
          }).map(item => {
            const active  = pathname === item.href || pathname.startsWith(item.href + "/");
            const navItem = NAV.find(n => n.href === item.href);
            const badgeNb = navItem ? navBadge((navItem as any).alertKey, notifications) : 0;
            return (
              <Link key={item.href} href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px]",
                  active ? "text-accent" : "text-muted2"
                )}>
                <span className="relative text-xl leading-none">
                  {item.icon}
                  {badgeNb > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-danger" />}
                </span>
                <span className={clsx("text-[10px] font-mono font-semibold", active ? "text-accent" : "text-muted")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          {/* Bouton "Plus" pour ouvrir le menu complet */}
          <button onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-muted2 min-w-[56px]">
            <span className="text-xl leading-none">☰</span>
            <span className="text-[10px] font-mono font-semibold text-muted">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
