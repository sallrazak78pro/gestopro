// lib/offline/sync.ts
// Moteur de synchronisation — envoie les opérations en attente au serveur

import { getPendingOps, updateOp, deleteOp } from "./db";

export type SyncResult = {
  synced:  number;
  failed:  number;
  errors:  { id: string; label: string; msg: string }[];
};

/**
 * Synchronise toutes les opérations en attente.
 * Stratégie de conflit : last-write-wins (via X-Client-Timestamp header)
 */
export async function syncAll(
  onProgress?: (current: number, total: number, label: string) => void
): Promise<SyncResult> {
  const ops    = await getPendingOps();
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    onProgress?.(i + 1, ops.length, op.label);
    await updateOp(op.id, { status: "syncing" });

    try {
      const res = await fetch(op.endpoint, {
        method:  op.method,
        headers: {
          "Content-Type":      "application/json",
          "X-Client-Timestamp": String(op.timestamp), // last-write-wins
          "X-Offline-Op":      "true",
        },
        body: op.body,
      });

      if (res.ok) {
        await deleteOp(op.id);
        result.synced++;
      } else {
        const json = await res.json().catch(() => ({}));
        const msg  = json.message ?? `Erreur ${res.status}`;

        // 409 Conflict → last-write-wins : on force avec le timestamp client
        if (res.status === 409) {
          const body = JSON.parse(op.body);
          const forceRes = await fetch(op.endpoint, {
            method:  op.method,
            headers: {
              "Content-Type":       "application/json",
              "X-Client-Timestamp": String(op.timestamp),
              "X-Force-Overwrite":  "true",
            },
            body: JSON.stringify({ ...body, _forceOverwrite: true }),
          });
          if (forceRes.ok) {
            await deleteOp(op.id);
            result.synced++;
          } else {
            throw new Error(msg);
          }
        } else {
          throw new Error(msg);
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? "Erreur inconnue";
      await updateOp(op.id, {
        status:   "error",
        retries:  op.retries + 1,
        errorMsg: msg,
      });
      result.failed++;
      result.errors.push({ id: op.id, label: op.label, msg });
    }
  }

  return result;
}

/**
 * Enregistre un Background Sync dans le service worker
 */
export async function requestBackgroundSync(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("SyncManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (reg as any).sync.register("sync-offline-ops");
  } catch {
    // Navigateur ne supporte pas Background Sync → sync manuel au retour en ligne
  }
}
