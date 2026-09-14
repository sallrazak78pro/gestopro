// lib/utils/ficheCompte.ts
// Vente.employe pointe toujours vers une fiche Employe. Quand le vendeur est
// un compte admin/gestionnaire/caissier sans fiche classique, on rattache la
// fiche "liée" à ce compte pour la boutique concernée — créée à la volée si
// besoin (userId défini, salaire 0), et masquée des pages Employés/Salaires
// (cf. SANS_COMPTE_UTILISATEUR dans lib/models/Employe.ts).
import mongoose from "mongoose";
import Employe from "@/lib/models/Employe";
import { ROLE_LABEL } from "@/lib/utils/roles";

interface CompteVendeur {
  _id: mongoose.Types.ObjectId | string;
  nom: string;
  prenom?: string;
  role: string;
}

export async function ficheEmployePourCompte(
  tenantId: string | mongoose.Types.ObjectId,
  boutiqueId: string | mongoose.Types.ObjectId,
  user: CompteVendeur
) {
  return Employe.findOneAndUpdate(
    { tenantId, boutique: boutiqueId, userId: user._id },
    { $setOnInsert: {
        tenantId, boutique: boutiqueId, userId: user._id,
        nom: user.nom, prenom: user.prenom || "",
        poste: ROLE_LABEL[user.role] ?? user.role,
        dateEmbauche: new Date(), salaireBase: 0, actif: true,
    } },
    { upsert: true, new: true }
  );
}
