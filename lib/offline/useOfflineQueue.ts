// lib/offline/useOfflineQueue.ts
// Hook React pour soumettre une opération avec fallback hors ligne

"use client";
import { useCallback } from "react";
import { addOp }       from "./db";
import { requestBackgroundSync } from "./sync";

export function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type QueueOptions = {
  endpoint: string;
  method?:  string;
  body:     Record<string, any>;
  label:    string;   // ex: "Vente comptoir — 12 500 F"
  module:   string;   // ex: "ventes"
};

type QueueResult =
  | { ok: true;  data: any;    offline: false }
  | { ok: true;  data: null;   offline: true;  opId: string }
  | { ok: false; error: string; offline: false };

export function useOfflineQueue() {
  const submit = useCallback(async (opts: QueueOptions): Promise<QueueResult> => {
    const { endpoint, method = "POST", body, label, module } = opts;
    const timestamp = Date.now();

    // ── Tentative en ligne ──────────────────────────────────
    if (navigator.onLine) {
      try {
        const res  = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type":       "application/json",
            "X-Client-Timestamp": String(timestamp),
          },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (res.ok) return { ok: true, data: json.data, offline: false };
        return { ok: false, error: json.message ?? "Erreur serveur", offline: false };
      } catch {
        // Réseau coupé malgré navigator.onLine — basculer hors ligne
      }
    }

    // ── Mode hors ligne : stocker localement ────────────────
    const opId = generateId();
    await addOp({
      id:        opId,
      endpoint,
      method,
      body:      JSON.stringify({ ...body, _clientTimestamp: timestamp }),
      timestamp,
      label,
      module,
    });

    // Demander un Background Sync
    await requestBackgroundSync();

    return { ok: true, data: null, offline: true, opId };
  }, []);

  return { submit };
}
