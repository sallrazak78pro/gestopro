// lib/context/AppDataContext.tsx
// Données partagées entre toutes les pages du dashboard (boutiques, tenant,
// notifications) — chargées une seule fois ici au lieu d'être re-fetchées
// indépendamment par chaque page/modale qui en a besoin.
"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AppDataValue {
  boutiques: any[];          // liste brute, actives uniquement, tous types (boutique + dépôt)
  boutiquesLoading: boolean;

  tenant: any | null;        // document tenant complet (Paramètres)
  meta: { nbUsers: number; nbBoutiques: number } | null;
  parametresLoading: boolean;
  mouvementsActifs: boolean; // raccourci pratique, dérivé de tenant
  refetchParametres: () => Promise<void>;

  notifications: any[];
  notifLoading: boolean;
  refetchNotifications: () => Promise<void>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData() doit être utilisé sous <AppDataProvider>");
  return ctx;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [boutiquesLoading, setBoutiquesLoading] = useState(true);

  const [tenant, setTenant] = useState<any | null>(null);
  const [meta, setMeta] = useState<{ nbUsers: number; nbBoutiques: number } | null>(null);
  const [parametresLoading, setParametresLoading] = useState(true);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const refetchParametres = useCallback(async () => {
    try {
      const res = await fetch("/api/parametres");
      const json = await res.json();
      if (json.success) { setTenant(json.data); setMeta(json.meta ?? null); }
    } catch {}
    setParametresLoading(false);
  }, []);

  const refetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) setNotifications(json.data);
    } catch {}
    setNotifLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/boutiques")
      .then(r => r.json())
      .then(j => { if (j.success) setBoutiques(j.data); })
      .catch(() => {})
      .finally(() => setBoutiquesLoading(false));
    refetchParametres();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refetchNotifications();
    const interval = setInterval(refetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetchNotifications]);

  return (
    <AppDataContext.Provider value={{
      boutiques, boutiquesLoading,
      tenant, meta, parametresLoading, mouvementsActifs: tenant?.mouvementsActifs ?? true, refetchParametres,
      notifications, notifLoading, refetchNotifications,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}
