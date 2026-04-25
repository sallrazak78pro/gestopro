// components/providers/PWAProvider.tsx
"use client";
import React from "react";
import { useEffect, useState } from "react";

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showBanner, setShowBanner]       = useState(false);
  const [, setSwReady]             = useState(false);

  // Enregistrement du Service Worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(reg => {
        setSwReady(true);
        console.log("[GestoPro PWA] Service worker enregistré:", reg.scope);
      })
      .catch(err => {
        console.warn("[GestoPro PWA] Échec enregistrement SW:", err);
      });
  }, []);

  // Capture de l'événement d'installation
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Afficher la bannière seulement si pas déjà installé
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      if (!isStandalone) {
        // Délai court avant d'afficher
        setTimeout(() => setShowBanner(true), 3000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  };

  return (
    <>
      {children}

      {/* Bannière d'installation */}
      {showBanner && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[200]
                     bg-surface border border-border2 rounded-2xl shadow-card p-4
                     flex items-start gap-3 animate-fade-in"
          style={{ animation: "slideUp 0.3s ease-out" }}
        >
          <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-accent flex items-center
                          justify-center text-xl font-extrabold text-white shadow-accent">
            G
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Installer GestoPro</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Accès rapide depuis votre écran d&apos;accueil, fonctionne hors ligne.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="btn-primary btn-sm flex-1"
              >
                📲 Installer
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="btn-ghost btn-sm"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-muted hover:text-white text-sm shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
