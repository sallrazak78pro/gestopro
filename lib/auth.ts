import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { checkRateLimit, resetRateLimit } from "@/lib/utils/rateLimit";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",           type: "email" },
        password: { label: "Mot de passe",    type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limiting par email
        const key    = `login:${credentials.email.toLowerCase()}`;
        const result = checkRateLimit(key);
        if (!result.allowed) {
          const minutes = Math.ceil((result.retryAfter ?? 1800) / 60);
          throw new Error(`Trop de tentatives. Réessayez dans ${minutes} min.`);
        }

        await connectDB();
        const user = await User.findOne({ email: credentials.email.toLowerCase(), actif: true });
        if (!user) return null;

        const ok = await user.comparePassword(credentials.password);
        if (!ok) return null;

        // Succès — réinitialiser le compteur
        resetRateLimit(key);

        return {
          id:       user._id.toString(),
          email:    user.email,
          name:     user.nom,
          role:     user.role,
          tenantId: user.tenantId?.toString() ?? null,
          boutique: user.boutique?.toString() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role     = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.boutique = (user as any).boutique;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id       = token.sub;
        (session.user as any).role     = token.role;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).boutique = token.boutique;
      }
      return session;
    },
  },
  // "Qui s'est connecté et quand" est la première chose qu'on cherche dans un
  // journal d'audit — les events NextAuth (plutôt que authorize(), qui ne
  // doit se soucier que de la validation des identifiants) sont l'endroit
  // recommandé pour ce genre d'effet de bord.
  events: {
    async signIn({ user }) {
      const u = user as any;
      if (!u.tenantId) return; // superadmin plateforme, hors tenant
      await connectDB();
      await logActivity({
        tenantId: u.tenantId, userId: u.id, userNom: u.name ?? "", role: u.role,
        action: ACTIONS.CONNEXION, module: MODULES.AUTH,
        details: `Connexion — ${u.email}`,
      });
    },
    async signOut({ token }) {
      const t = token as any;
      if (!t?.tenantId || !t?.sub) return;
      await connectDB();
      await logActivity({
        tenantId: t.tenantId, userId: t.sub, userNom: t.name ?? "", role: t.role,
        action: ACTIONS.DECONNEXION, module: MODULES.AUTH,
        details: `Déconnexion — ${t.email ?? ""}`,
      });
    },
  },
  pages:   { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret:  process.env.NEXTAUTH_SECRET,
  cookies: process.env.NODE_ENV === "production" ? {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict" as const,
        path:     "/",
        secure:   true,
      },
    },
  } : undefined,
};
