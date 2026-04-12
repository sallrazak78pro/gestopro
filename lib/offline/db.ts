// lib/offline/db.ts
// Wrapper IndexedDB pour la file d'attente des opérations hors ligne

export type OpStatus = "pending" | "syncing" | "done" | "error";

export interface PendingOp {
  id:          string;      // UUID local
  endpoint:    string;      // ex: "/api/ventes"
  method:      string;      // POST / PUT / PATCH
  body:        string;      // JSON stringifié
  timestamp:   number;      // Date.now() — "last write wins"
  status:      OpStatus;
  retries:     number;
  errorMsg?:   string;
  label:       string;      // ex: "Vente VNT-2024-0012"
  module:      string;      // ex: "ventes" | "stock" | "mouvements"
}

const DB_NAME    = "gestopro-offline";
const DB_VERSION = 1;
const STORE      = "pending_ops";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db    = req.result;
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("status",    "status",    { unique: false });
      store.createIndex("timestamp", "timestamp", { unique: false });
      store.createIndex("module",    "module",    { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function addOp(op: Omit<PendingOp, "status" | "retries">): Promise<void> {
  const db    = await openDB();
  const full: PendingOp = { ...op, status: "pending", retries: 0 };
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(full);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function getAllOps(): Promise<PendingOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingOp[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const all = await getAllOps();
  return all
    .filter(op => op.status === "pending" || op.status === "error")
    .sort((a, b) => a.timestamp - b.timestamp); // plus ancien en premier
}

export async function updateOp(id: string, updates: Partial<PendingOp>): Promise<void> {
  const db = await openDB();
  return new Promise(async (resolve, reject) => {
    const tx    = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) { resolve(); return; }
      const putReq = store.put({ ...existing, ...updates });
      putReq.onsuccess = () => resolve();
      putReq.onerror   = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteOp(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function countPending(): Promise<number> {
  const ops = await getPendingOps();
  return ops.length;
}

export async function clearDone(): Promise<void> {
  const db  = await openDB();
  const all = await getAllOps();
  const done = all.filter(op => op.status === "done");
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let count = done.length;
    if (!count) { resolve(); return; }
    done.forEach(op => {
      const req = store.delete(op.id);
      req.onsuccess = () => { if (--count === 0) resolve(); };
      req.onerror   = () => reject(req.error);
    });
  });
}
