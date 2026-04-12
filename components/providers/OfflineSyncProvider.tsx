// components/providers/OfflineSyncProvider.tsx
"use client";
import React from "react";
import {
  createContext, useContext, useEffect, useState,
  useCallback, useRef,
} from "react";
import { countPending, getAllOps, clearDone, PendingOp } from "@/lib/offline/db";
import { syncAll } from "@/lib/offline/sync";

type SyncStatus = "idle" | "syncing" | "success" | "error";

type OfflineCtx = {
  isOnline:     boolean;
  nbPending:    number;
  syncStatus:   SyncStatus;
  lastSync:     Date | null;
  ops:          PendingOp[];
  triggerSync:  () => void;
  refreshOps:   () => void;
};

const Ctx = createContext<OfflineCtx>({
  isOnline: true, nbPending: 0, syncStatus: "idle",
  lastSync: null, ops: [], triggerSync: () => {}, refreshOps: () => {},
});

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline,   setIsOnline]   = useState(true);
  const [nbPending,  setNbPending]  = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSync,   setLastSync]   = useState<Date | null>(null);
  const [ops,        setOps]        = useState<PendingOp[]>([]);
  const syncingRef = useRef(false);

  const refreshOps = useCallback(async () => {
    try {
      const all     = await getAllOps();
      const pending = all.filter(op => op.status !== "done");
      setOps(pending);
      setNbPending(pending.filter(op => op.status === "pending" || op.status === "error").length);
    } catch {}
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const result = await syncAll();
      await clearDone();
      await refreshOps();
      setLastSync(new Date());
      setSyncStatus(result.failed > 0 ? "error" : "success");
      // Revenir à "idle" après 4s
      setTimeout(() => setSyncStatus("idle"), 4000);
    } catch {
      setSyncStatus("error");
    } finally {
      syncingRef.current = false;
    }
  }, [refreshOps]);

  // Online / Offline listeners
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  triggerSync(); };
    const onOffline = () => { setIsOnline(false); };
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [triggerSync]);

  // Message du service worker (Background Sync déclenché)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "SYNC_COMPLETE") {
        refreshOps();
        setLastSync(new Date());
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [refreshOps]);

  // Polling léger toutes les 30s pour rafraîchir le compteur
  useEffect(() => {
    refreshOps();
    const interval = setInterval(refreshOps, 30_000);
    return () => clearInterval(interval);
  }, [refreshOps]);

  // Sync auto au montage si en ligne et ops en attente
  useEffect(() => {
    if (navigator.onLine) {
      countPending().then(n => { if (n > 0) triggerSync(); });
    }
  }, [triggerSync]);

  return (
    <Ctx.Provider value={{ isOnline, nbPending, syncStatus, lastSync, ops, triggerSync, refreshOps }}>
      {children}
      <OfflineStatusBar />
    </Ctx.Provider>
  );
}

export const useOfflineSync = () => useContext(Ctx);

// ── Barre de statut flottante ────────────────────────────────
function OfflineStatusBar() {
  const { isOnline, nbPending, syncStatus, lastSync, triggerSync } = useOfflineSync();

  const fmt = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // Caché si tout est OK et en ligne
  if (isOnline && nbPending === 0 && syncStatus === "idle") return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3
                 px-4 py-2.5 rounded-2xl shadow-card text-sm font-mono border backdrop-blur-sm"
      style={{
        background:  isOnline
          ? syncStatus === "error"   ? "rgba(239,68,68,0.15)"
          : syncStatus === "syncing" ? "rgba(0,212,255,0.12)"
          : syncStatus === "success" ? "rgba(16,185,129,0.12)"
          : "rgba(245,158,11,0.12)"
          : "rgba(100,116,139,0.2)",
        borderColor: isOnline
          ? syncStatus === "error"   ? "rgba(239,68,68,0.4)"
          : syncStatus === "syncing" ? "rgba(0,212,255,0.3)"
          : syncStatus === "success" ? "rgba(16,185,129,0.4)"
          : "rgba(245,158,11,0.4)"
          : "rgba(100,116,139,0.3)",
      }}
    >
      {/* Icône */}
      {!isOnline && <span>📡</span>}
      {isOnline && syncStatus === "syncing" && (
        <svg className="animate-spin w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      )}
      {isOnline && syncStatus === "success" && <span>✅</span>}
      {isOnline && syncStatus === "error"   && <span>⚠️</span>}
      {isOnline && syncStatus === "idle" && nbPending > 0 && <span>🟡</span>}

      {/* Texte */}
      <span style={{ color: "var(--color-fg)" }}>
        {!isOnline
          ? `Hors ligne · ${nbPending > 0 ? `${nbPending} opération${nbPending > 1 ? "s" : ""} en attente` : "Mode lecture"}`
          : syncStatus === "syncing"
          ? "Synchronisation..."
          : syncStatus === "success"
          ? `Synchronisé${lastSync ? ` à ${fmt(lastSync)}` : ""}`
          : syncStatus === "error"
          ? "Erreur de sync · Réessayer"
          : `${nbPending} opération${nbPending > 1 ? "s" : ""} à synchroniser`}
      </span>

      {/* Bouton sync manuel */}
      {isOnline && syncStatus !== "syncing" && nbPending > 0 && (
        <button
          onClick={triggerSync}
          className="ml-1 text-accent hover:text-white transition-colors font-bold text-xs"
        >
          Sync →
        </button>
      )}
    </div>
  );
}
