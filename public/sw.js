// public/sw.js — GestoPro Service Worker v2.0 (Offline + Background Sync)

const CACHE_NAME  = "gestopro-v2";
const OFFLINE_URL = "/offline";
const API_PREFIX  = "/api/";

const STATIC_ASSETS = [
  "/offline",
  "/dashboard",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ── Installation ───────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// ── Activation ────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.protocol !== "https:" && url.hostname !== "localhost") return;

  // API → network-first, fallback cache
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(cached => cached ??
            new Response(
              JSON.stringify({ success: false, offline: true, message: "Hors ligne" }),
              { headers: { "Content-Type": "application/json" } }
            )
          )
        )
    );
    return;
  }

  // Statiques → cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/) ||
      url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(cached => cached ?? fetch(request).then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // Pages HTML → network-first, fallback cache, puis /offline
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match(OFFLINE_URL) ??
          new Response("Hors ligne", { status: 503 });
      })
  );
});

// ── Background Sync ────────────────────────────────────
self.addEventListener("sync", event => {
  if (event.tag === "sync-offline-ops") {
    event.waitUntil(runBackgroundSync());
  }
});

async function runBackgroundSync() {
  // Ouvre IndexedDB directement depuis le SW
  const db = await openOfflineDB();
  const ops = await getPendingOps(db);
  if (!ops.length) return;

  let synced = 0;
  for (const op of ops) {
    try {
      const res = await fetch(op.endpoint, {
        method:  op.method,
        headers: {
          "Content-Type":       "application/json",
          "X-Client-Timestamp": String(op.timestamp),
          "X-Offline-Op":       "true",
        },
        body: op.body,
      });

      if (res.ok || res.status === 409) {
        // En cas de 409 → last-write-wins : on force
        if (res.status === 409) {
          const body = JSON.parse(op.body);
          await fetch(op.endpoint, {
            method:  op.method,
            headers: {
              "Content-Type":       "application/json",
              "X-Client-Timestamp": String(op.timestamp),
              "X-Force-Overwrite":  "true",
            },
            body: JSON.stringify({ ...body, _forceOverwrite: true }),
          });
        }
        await deleteOp(db, op.id);
        synced++;
      }
    } catch {
      // Réseau encore indisponible → laisser en pending
    }
  }

  // Notifier le client que la sync est terminée
  if (synced > 0) {
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.postMessage({ type: "SYNC_COMPLETE", synced }));
  }
}

// ── IndexedDB helpers dans le SW ───────────────────────
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("gestopro-offline", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore("pending_ops", { keyPath: "id" });
      store.createIndex("status", "status", { unique: false });
    };
  });
}

function getPendingOps(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction("pending_ops", "readonly");
    const req = tx.objectStore("pending_ops").getAll();
    req.onsuccess = () =>
      resolve(req.result.filter(op => op.status === "pending" || op.status === "error")
                         .sort((a, b) => a.timestamp - b.timestamp));
    req.onerror = () => reject(req.error);
  });
}

function deleteOp(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction("pending_ops", "readwrite");
    const req = tx.objectStore("pending_ops").delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Push notifications ─────────────────────────────────
self.addEventListener("push", event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "GestoPro", {
      body:    data.body ?? "",
      icon:    "/icons/icon-192x192.png",
      badge:   "/icons/icon-96x96.png",
      data:    { url: data.url ?? "/alertes" },
      actions: [{ action: "voir", title: "Voir →" }, { action: "fermer", title: "Fermer" }],
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "fermer") return;
  const url = event.notification.data?.url ?? "/alertes";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          c.navigate(url); return c.focus();
        }
      }
      return clients.openWindow?.(url);
    })
  );
});
