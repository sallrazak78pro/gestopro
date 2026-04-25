/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint — désactivé au build (FlatCompat/minimatch ESM conflict on Vercel)
  // La vérification de types TypeScript garantit la qualité du code.
  eslint: { ignoreDuringBuilds: true },

  // Images — Cloudinary
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    minimumCacheTTL: 60,
  },

  // ── Headers de sécurité ─────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Anti-clickjacking
          { key: "X-Frame-Options",          value: "DENY" },
          // Anti-sniffing MIME type
          { key: "X-Content-Type-Options",   value: "nosniff" },
          // Referrer policy
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          // Pas d'indexation des pages internes
          { key: "X-Robots-Tag",             value: "noindex, nofollow" },
          // Permissions navigateur
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
          // HSTS (HTTPS seulement en production)
          ...(process.env.NODE_ENV === "production" ? [
            { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          ] : []),
        ],
      },
      // PWA — Service Worker
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control",           value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type",            value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed",  value: "/" },
        ],
      },
      // Manifest PWA
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      // Icônes PWA — cache long
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
        ],
      },
      // APIs — pas de cache navigateur
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma",        value: "no-cache" },
        ],
      },
    ];
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": require("path").resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;
