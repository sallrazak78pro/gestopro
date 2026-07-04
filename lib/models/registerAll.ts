// lib/models/registerAll.ts
// Enregistre tous les schémas Mongoose une seule fois, au démarrage de la
// connexion — évite les erreurs "Schema hasn't been registered for model X"
// quand une route appelle .populate("champ") sans avoir elle-même importé
// le modèle référencé. Sur Vercel, chaque route peut être la première à
// s'exécuter dans une instance serverless neuve : on ne peut pas compter sur
// l'ordre d'import d'une autre route pour enregistrer un modèle à sa place.
import "./ActivityLog";
import "./AvanceSalaire";
import "./Boutique";
import "./Catalogue";
import "./CommandeFournisseur";
import "./CompteTiers";
import "./Employe";
import "./ErreurSignalee";
import "./Fournisseur";
import "./MouvementArgent";
import "./MouvementStock";
import "./PaiementSalaire";
import "./Produit";
import "./ResetToken";
import "./SessionCaisse";
import "./Stock";
import "./Tenant";
import "./User";
import "./Vente";
