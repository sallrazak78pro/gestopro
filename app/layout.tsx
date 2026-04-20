// app/layout.tsx
import React from "react";
import type { Metadata, Viewport } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import PWAProvider    from "@/components/providers/PWAProvider";
import { ThemeProvider }       from "@/components/providers/ThemeProvider";
import { OfflineSyncProvider } from "@/components/providers/OfflineSyncProvider";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:  "GestoPro — ERP de gestion",
    template: "%s · GestoPro",
  },
  description: "Gestion des ventes, stocks, trésorerie, fournisseurs et employés",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GestoPro",
    startupImage: "/icons/icon-512x512.png",
  },
  icons: {
    icon:    [
      { url: "/icons/icon-32x32.png",  sizes: "32x32",  type: "image/png" },
      { url: "/icons/icon-192x192.png",sizes: "192x192",type: "image/png" },
    ],
    apple:   [{ url: "/icons/icon-152x152.png", sizes: "152x152" }],
    shortcut: "/favicon.png",
  },
  other: {
    "mobile-web-app-capable":         "yes",
    "apple-mobile-web-app-capable":   "yes",
    "application-name":               "GestoPro",
    "msapplication-TileColor":        "#0b0b18",
    "msapplication-TileImage":        "/icons/icon-144x144.png",
  },
};

export const viewport: Viewport = {
  themeColor:   [
    { media: "(prefers-color-scheme: dark)",  color: "#0b0b18" },
    { media: "(prefers-color-scheme: light)", color: "#0b0b18" },
  ],
  width:              "device-width",
  initialScale:       1,
  maximumScale:       1,
  userScalable:       false,
  viewportFit:        "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode; }) {
  return (
    <html lang="fr" className={`${syne.variable} ${dmMono.variable}`}>
      <head>
        {/* Anti-flash thème : applique la classe avant le rendu */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('gestopro-theme') || 'light';
              if (t === 'light') document.documentElement.classList.add('light');
            } catch(e) {
              document.documentElement.classList.add('light');
            }
          })();
        `}} />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <OfflineSyncProvider>
              <PWAProvider>
                {children}
              </PWAProvider>
            </OfflineSyncProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
