// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Routes interdites par rôle (préfixes)
// Caissier = mêmes pages que gestionnaire, mais données filtrées sur sa boutique (voir tenant.ts)
const ROLE_RESTRICTIONS: Record<string, string[]> = {
  gestionnaire: [
    "/fournisseurs", "/commandes",
    "/salaires", "/boutiques", "/utilisateurs", "/parametres",
  ],
  caissier: [
    "/fournisseurs", "/commandes",
    "/salaires", "/boutiques", "/utilisateurs", "/parametres",
  ],
};

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const path  = req.nextUrl.pathname;
    const isSuperAdmin = token?.role === "superadmin" && !token?.tenantId;

    // /admin réservé au superadmin plateforme
    if (path.startsWith("/admin") && !isSuperAdmin)
      return NextResponse.redirect(new URL("/dashboard", req.url));

    // Les users normaux ne peuvent pas accéder à /admin
    if (isSuperAdmin && path.startsWith("/dashboard"))
      return NextResponse.redirect(new URL("/admin", req.url));

    // Restrictions par rôle
    const role = token?.role as string;
    const restricted = ROLE_RESTRICTIONS[role] ?? [];
    for (const prefix of restricted) {
      if (path.startsWith(prefix))
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Accès aux paramètres : admin et superadmin seulement
    if (path.startsWith("/parametres") && !["admin","superadmin"].includes(role) && !isSuperAdmin)
      return NextResponse.redirect(new URL("/dashboard", req.url));

    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
  }
);

// Protège tout sauf les pages publiques
export const config = {
  matcher: [
    "/((?!$|login|register|forgot-password|reset-password|api/auth|api/register|api/setup|setup|_next/static|_next/image|favicon.ico|favicon.png|manifest.json|icons|sw.js|print).*)"
  ],
};
