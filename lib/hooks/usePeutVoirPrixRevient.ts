// lib/hooks/usePeutVoirPrixRevient.ts
"use client";
import { useSession } from "next-auth/react";
import { useAppData } from "@/lib/context/AppDataContext";
import { peutVoirPrixRevient } from "@/lib/utils/permissions";

/**
 * Droit « Marges et prix de revient » de l'utilisateur courant, côté écran :
 * prix d'achat, marges, valeur du stock au coût, montants des mouvements de
 * stock. Le serveur retire de toute façon ces données de ses réponses — ce
 * hook sert à ne pas afficher de libellés ou de champs vides à leur place.
 *
 * À n'utiliser que sous <AppDataProvider> (pages du tableau de bord) ; les
 * pages d'impression lisent le drapeau `voitCout` renvoyé par l'API.
 */
export function usePeutVoirPrixRevient(): boolean {
  const { data: session } = useSession();
  const { tenant } = useAppData();
  return peutVoirPrixRevient((session?.user as any)?.role ?? "", tenant?.permissions);
}
