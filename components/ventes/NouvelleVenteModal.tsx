// components/ventes/NouvelleVenteModal.tsx
"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import clsx from "clsx";
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";
import { useSession } from "next-auth/react";
import { formatMontant, arrondirFCFA, PAS_FCFA, formatNombre as fmt } from "@/lib/utils/devise";
import { useAppData } from "@/lib/context/AppDataContext";

interface Produit  { _id: string; reference: string; nom: string; prixVente: number; unite: string; image?: string; }
interface Ligne {
  produitId: string;
  nomProduit: string;
  unite: string;
  quantite: number;        // peut être décimal ex: 1.5
  prixUnitaire: number;    // modifiable à la vente
  prixRef: number;         // prix de référence du catalogue
  sousTotal: number;
}

const fmtQte = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2);
// Mémorise la dernière boutique choisie (admin multi-boutiques) pour ne pas
// avoir à la resélectionner à chaque nouvelle vente.
const LAST_BOUTIQUE_KEY = "gestopro:derniere-boutique-vente";

export default function NouvelleVenteModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: (stockWarning?: string) => void }) {
  const { submit } = useOfflineQueue();
  const { data: session } = useSession();
  const userBoutique = (session?.user as any)?.boutique ?? "";
  // Toute personne avec une boutique assignée (caissier OU gestionnaire) y
  // est restreinte côté serveur — le champ doit donc être fixe pour elle,
  // pas seulement pour un caissier.
  const boutiqueVerrouillee = !!userBoutique;

  const [step, setStep]         = useState<"panier" | "paiement">("panier");
  // Sur mobile, catalogue et panier ne peuvent pas tenir tous les deux à
  // l'écran en même temps sans devenir illisibles — on bascule entre les deux
  // plutôt que de les empiler sur une hauteur trop réduite pour l'un ou l'autre.
  const [vueMobile, setVueMobile] = useState<"catalogue" | "panier">("catalogue");
  const { boutiques: boutiquesToutes } = useAppData();
  const boutiques = useMemo(() => boutiquesToutes.filter((b: any) => b.type === "boutique"), [boutiquesToutes]);
  const [produits, setProduits]   = useState<Produit[]>([]);
  const [boutiqueId, setBoutiqueId] = useState("");
  const [employes, setEmployes]       = useState<any[]>([]);
  const [employeId, setEmployeId]     = useState("");
  const [sessionOuverte, setSessionOuverte] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [search, setSearch]       = useState("");
  const [panier, setPanier]       = useState<Ligne[]>([]);
  const [client, setClient]       = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [montantRecu, setMontantRecu]   = useState<string>("");
  const [statut, setStatut]       = useState("payee");
  const [note, setNote]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  // Prix éditable en ligne
  const [editPrix, setEditPrix]   = useState<string | null>(null); // produitId en cours d'édition
  // Texte brut tapé dans le champ Qté, tant que l'édition n'est pas finalisée
  // (onBlur/Entrée) — évite que le champ ne "rebondisse" à l'ancienne valeur
  // dès qu'on l'efface pour taper autre chose (ex: effacer "12" pour taper "0.5").
  const [qteDraft, setQteDraft]   = useState<Record<string, string>>({});
  // Confirmation avant de fermer avec un panier non vide — un window.confirm()
  // natif est parfois filtré/masqué dans un contexte PWA installé sur mobile,
  // d'où une boîte de dialogue maison, garantie de s'afficher.
  const [confirmClose, setConfirmClose] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session || boutiques.length === 0) return; // Attendre session + boutiques chargées
    // Boutique assignée (caissier ou gestionnaire) → toujours présélectionnée
    if (boutiqueVerrouillee) {
      setBoutiqueId(userBoutique);
    } else if (boutiques.length === 1) {
      setBoutiqueId(boutiques[0]._id);
    } else {
      const derniere = localStorage.getItem(LAST_BOUTIQUE_KEY);
      if (derniere && boutiques.some((b: any) => b._id === derniere)) setBoutiqueId(derniere);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, boutiques]);

  // Vérifier la session de caisse dès qu'une boutique est choisie
  useEffect(() => {
    if (!boutiqueId) { setSessionOuverte(null); return; }
    setSessionLoading(true);
    fetch(`/api/sessions-caisse/active?boutiqueId=${boutiqueId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setSessionOuverte(j.data);
      })
      .finally(() => setSessionLoading(false));
  }, [boutiqueId]);

  // Charger les employés de la boutique sélectionnée
  useEffect(() => {
    if (!boutiqueId) { setEmployes([]); setEmployeId(""); return; }
    fetch(`/api/employes?boutiqueId=${boutiqueId}&pourVente=1`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setEmployes(j.data);
          // Pré-sélectionner le premier si 1 seul résultat
          if (j.data.length === 1) setEmployeId(j.data[0]._id);
        }
      });
  }, [boutiqueId]);

  const fetchProduits = useCallback(async () => {
    if (!boutiqueId) return;
    const params = new URLSearchParams({ search, boutiqueId, avecImage: "1" });
    const res  = await fetch(`/api/produits?${params}`);
    const json = await res.json();
    if (json.success) setProduits(json.data);
  }, [boutiqueId, search]);

  useEffect(() => { fetchProduits(); }, [fetchProduits]);

  const total   = panier.reduce((s, l) => s + l.sousTotal, 0);
  // En FCFA la plus petite pièce est de 5 F : une quantité ou un prix décimal
  // peut donner un total comme 15 172,21 F, mais on encaisse et on rend la
  // monnaie au multiple de 5 le plus proche (15 170 F).
  const totalARegler = arrondirFCFA(total);
  const monnaie = montantRecu !== "" ? arrondirFCFA(+montantRecu) - totalARegler : 0;

  // Un clic accidentel en dehors (ou sur ✕) ne doit pas faire perdre un
  // panier déjà constitué — seule une confirmation explicite, ou une
  // suppression article par article, doit pouvoir le vider.
  function handleClose() {
    if (panier.length > 0) { setConfirmClose(true); return; }
    onClose();
  }

  // ── Ajouter un produit au panier ──────────────────────────
  function ajouterProduit(p: Produit) {
    setPanier(prev => {
      const exist = prev.find(l => l.produitId === p._id);
      if (exist) {
        return prev.map(l =>
          l.produitId === p._id
            ? { ...l, quantite: +(l.quantite + 1).toFixed(3), sousTotal: +(((l.quantite + 1) * l.prixUnitaire).toFixed(2)) }
            : l
        );
      }
      return [...prev, {
        produitId: p._id, nomProduit: p.nom, unite: p.unite,
        quantite: 1, prixUnitaire: p.prixVente, prixRef: p.prixVente,
        sousTotal: p.prixVente,
      }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  // ── Modifier la quantité (décimale) ──────────────────────
  function applyQte(produitId: string, qte: number) {
    setPanier(prev => prev.map(l =>
      l.produitId === produitId
        ? { ...l, quantite: qte, sousTotal: +(qte * l.prixUnitaire).toFixed(2) }
        : l
    ));
  }

  // Utilisé par les boutons -/+ : valeur déjà calculée et définitive.
  function updateQte(produitId: string, qteStr: string) {
    setQteDraft(prev => { const { [produitId]: _, ...rest } = prev; return rest; });
    const qte = parseFloat(qteStr);
    if (isNaN(qte) || qte < 0) return;
    if (qte === 0) {
      setPanier(prev => prev.filter(l => l.produitId !== produitId));
      return;
    }
    applyQte(produitId, qte);
  }

  // Pendant la saisie au clavier : on garde le texte tel quel (même vide ou
  // "0" en cours de frappe) et on ne recalcule le panier que si la valeur
  // est déjà un nombre valide > 0 — pas de suppression prématurée de la
  // ligne tant que la saisie n'est pas terminée.
  function handleQteInput(produitId: string, raw: string) {
    setQteDraft(prev => ({ ...prev, [produitId]: raw }));
    const qte = parseFloat(raw);
    if (!isNaN(qte) && qte > 0) applyQte(produitId, qte);
  }

  // Finalise la saisie (perte du focus ou Entrée) : une valeur nulle/vide/
  // invalide à ce stade supprime la ligne, comme le bouton "-" jusqu'à 0.
  function commitQteInput(produitId: string) {
    const raw = qteDraft[produitId];
    setQteDraft(prev => { const { [produitId]: _, ...rest } = prev; return rest; });
    if (raw === undefined) return;
    const qte = parseFloat(raw);
    if (isNaN(qte) || qte <= 0) {
      setPanier(prev => prev.filter(l => l.produitId !== produitId));
    } else {
      applyQte(produitId, qte);
    }
  }

  // ── Modifier le prix à la vente ───────────────────────────
  function updatePrix(produitId: string, prixStr: string) {
    const prix = parseFloat(prixStr);
    if (isNaN(prix) || prix < 0) return;
    setPanier(prev => prev.map(l =>
      l.produitId === produitId
        ? { ...l, prixUnitaire: prix, sousTotal: +(l.quantite * prix).toFixed(2) }
        : l
    ));
  }

  // ── Supprimer une ligne ────────────────────────────────────
  function supprimerLigne(produitId: string) {
    setPanier(prev => prev.filter(l => l.produitId !== produitId));
  }

  // ── Valider la vente ──────────────────────────────────────
  async function handleSubmit() {
    setError(""); setLoading(true);
    // Ouvrir l'onglet tout de suite, en synchrone dans le clic — sinon le
    // navigateur bloque window.open() après un await (perte du contexte
    // "geste utilisateur"). On le redirige vers le ticket une fois créé.
    const printTab = window.open("", "_blank");
    const body = {
      boutiqueId, client, lignes: panier,
      modePaiement, montantRecu: montantRecu !== "" ? arrondirFCFA(+montantRecu) : totalARegler,
      note, statut, employeId,
    };
    const result = await submit({
      endpoint: "/api/ventes",
      method:   "POST",
      body,
      label:    `Vente ${client || "comptoir"} — ${formatMontant(total)}`,
      module:   "ventes",
    });
    setLoading(false);
    if (!result.ok) {
      printTab?.close();
      setError((result as any).error ?? "Une erreur est survenue.");
      return;
    }
    if (result.offline) {
      // Impossible d'imprimer : pas encore d'ID serveur pour une vente en attente de sync.
      printTab?.close();
      setError(""); // Pas d'erreur — sauvegardé localement
    } else if (result.data?._id && printTab) {
      printTab.location.href = `/print/vente/${result.data._id}`;
    } else {
      printTab?.close();
    }
    // Stock insuffisant n'empêche plus la vente — juste une suggestion à
    // l'utilisateur d'ajuster son inventaire, affichée après coup sur la
    // page (le modal se ferme déjà à ce stade).
    const warnings = (result as any).data?.stockWarnings as string[] | undefined;
    onSaved(
      warnings?.length
        ? `Stock à ajuster : ${warnings.join(", ")}`
        : undefined
    );
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Hauteur fixe (pas min/max) — sinon la modale grandit et rétrécit à
          chaque changement de contenu (ajout d'un article, bascule
          catalogue/panier, passage à l'étape paiement...), ce qui fait
          "sauter" l'écran au lieu de rester stable. */}
      <div className="relative w-full max-w-5xl card animate-slide-up flex flex-col h-[92vh]">

        {/* Header — compact sur mobile : le titre disparaît (redondant avec
            le contexte) et les marges rétrécissent, pour laisser le plus de
            hauteur possible au panier en dessous. */}
        <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-4 border-b border-border shrink-0">
          <div>
            <h2 className="hidden sm:block text-lg font-bold">Nouvelle vente</h2>
            <div className="flex items-center gap-2 sm:mt-1">
              {["panier", "paiement"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-px bg-border" />}
                  <span className={clsx("flex items-center gap-1.5 text-xs font-mono",
                    step === s ? "text-accent" : "text-muted")}>
                    <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      step === s ? "bg-accent text-bg" : "bg-surface2 text-muted")}>
                      {i + 1}
                    </span>
                    {s === "panier" ? "Panier" : "Paiement"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={handleClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* ── ÉTAPE 1 : PANIER ──────────────────────────── */}
        {step === "panier" && (
          <>
            {/* Bascule catalogue/panier — mobile uniquement. Chaque section
                prend alors toute la hauteur disponible plutôt que de se
                partager un espace trop réduit pour être utilisable. */}
            <div className="flex md:hidden shrink-0 border-b border-border p-1.5 gap-1.5">
              <button type="button" onClick={() => setVueMobile("catalogue")}
                className={clsx("flex-1 text-xs font-mono font-semibold py-2 rounded-lg transition-all",
                  vueMobile === "catalogue" ? "bg-accent text-bg" : "bg-surface2 text-muted")}>
                🔍 Produits
              </button>
              <button type="button" onClick={() => setVueMobile("panier")}
                className={clsx("flex-1 text-xs font-mono font-semibold py-2 rounded-lg transition-all",
                  vueMobile === "panier" ? "bg-accent text-bg" : "bg-surface2 text-muted")}>
                🛒 Panier{panier.length > 0 ? ` (${panier.length})` : ""}
              </button>
            </div>

          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

            {/* LEFT — catalogue */}
            <div className={clsx(
              vueMobile === "catalogue" ? "flex" : "hidden", "md:flex",
              "w-full md:w-5/12 border-b md:border-b-0 md:border-r border-border flex-col p-2.5 sm:p-4 gap-2 sm:gap-3 overflow-hidden shrink-0"
            )}>

              <div>
                <label className="input-label">Boutique *</label>
                {boutiqueVerrouillee ? (
                  // Boutique assignée : fixe, non modifiable
                  <div className="input bg-surface text-muted2 cursor-not-allowed flex items-center gap-2">
                    <span>🏪</span>
                    <span>{boutiques.find(b => b._id === boutiqueId)?.nom ?? "Chargement..."}</span>
                  </div>
                ) : (
                  <select className="select text-sm" value={boutiqueId}
                    onChange={e => {
                      const v = e.target.value;
                      setBoutiqueId(v);
                      setPanier([]);
                      if (v) localStorage.setItem(LAST_BOUTIQUE_KEY, v);
                      else localStorage.removeItem(LAST_BOUTIQUE_KEY);
                    }}>
                    <option value="">Choisir...</option>
                    {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
                  </select>
                )}
              </div>

              {/* ── Alerte session caisse ──────────────── */}
              {boutiqueId && (
                sessionLoading ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-muted animate-pulse px-3 py-2 bg-surface2 rounded-lg">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Vérification de la caisse...
                  </div>
                ) : sessionOuverte?.session ? (
                  <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                    <span className="text-success text-sm">🟢</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-success">Caisse ouverte</p>
                      <p className="text-[10px] font-mono text-muted truncate">
                        par {sessionOuverte.session.ouvertPar?.nom} · fond : {formatMontant(sessionOuverte.session.fondOuverture)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-3">
                    <span className="text-danger text-lg shrink-0">🔒</span>
                    <div>
                      <p className="text-xs font-bold text-danger">Caisse fermée</p>
                      <p className="text-[10px] text-muted mt-0.5">
                        Impossible de vendre. Ouvrez la caisse depuis le menu <strong className="text-white">Caisse</strong> d&apos;abord.
                      </p>
                    </div>
                  </div>
                )
              )}

              <div>
                <label className="input-label">Rechercher un produit</label>
                <input
                  ref={searchRef}
                  className="input text-sm"
                  placeholder="🔍  Nom ou référence..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  disabled={!boutiqueId || !sessionOuverte?.session}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1">
                {!boutiqueId ? (
                  <p className="text-center text-muted font-mono text-xs py-8">Sélectionne une boutique</p>
                ) : !sessionOuverte?.session && !sessionLoading ? (
                  <p className="text-center text-muted font-mono text-xs py-8">
                    🔒 Ouvre la caisse pour chercher des produits
                  </p>
                ) : produits.length === 0 ? (
                  <p className="text-center text-muted font-mono text-xs py-8">Aucun produit</p>
                ) : produits.map(p => (
                  <button key={p._id} type="button" onClick={() => ajouterProduit(p)}
                    className="w-full flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-xl
                               bg-surface2 hover:bg-surface hover:border-border2 border border-transparent
                               transition-all text-left group">
                    {/* Miniature image */}
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-base sm:text-lg"
                      style={{ background: "var(--color-surface3)", border: "1px solid var(--color-border)" }}>
                      {p.image
                        ? <img src={p.image} alt={p.nom} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        : "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">{p.nom}</p>
                      <p className="text-[9px] sm:text-[10px] font-mono text-muted truncate">{p.reference} · {p.unite}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs sm:text-sm font-mono font-bold text-accent whitespace-nowrap">{formatMontant(p.prixVente)}</p>
                      <p className="hidden sm:block text-[10px] text-success opacity-0 group-hover:opacity-100 transition-opacity">
                        + Ajouter
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT — panier */}
            <div className={clsx(vueMobile === "panier" ? "flex" : "hidden", "md:flex", "flex-1 flex-col overflow-hidden")}>

              {/* En-têtes colonnes — masqués sur mobile, où chaque ligne est
                  assez compacte pour tenir sur une seule rangée sans elles. */}
              {panier.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-4 pt-3 pb-1 border-b border-border/50 shrink-0">
                  <p className="flex-1 text-[10px] font-mono text-muted uppercase tracking-wider">Produit</p>
                  <p className="w-28 text-[10px] font-mono text-muted uppercase tracking-wider text-center">Qté</p>
                  <p className="w-24 text-[10px] font-mono text-muted uppercase tracking-wider text-center">
                    Prix unit. <span className="text-accent/70">(modifiable)</span>
                  </p>
                  <p className="w-20 text-[10px] font-mono text-muted uppercase tracking-wider text-right">Sous-total</p>
                  <div className="w-6" />
                </div>
              )}

              {/* Lignes du panier */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {panier.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted">
                    <p className="text-5xl mb-3 opacity-30">🛒</p>
                    <p className="font-mono text-sm">Panier vide</p>
                    <p className="font-mono text-xs mt-1 text-muted/70">Clique sur un produit pour l&apos;ajouter</p>
                  </div>
                ) : panier.map(l => (
                  <div key={l.produitId}
                    className="flex items-center gap-1.5 sm:gap-2 bg-surface2 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2.5 group">

                    {/* Nom — une seule ligne compacte, tronquée si besoin ;
                        l'unité passe en suffixe pour ne pas prendre une
                        deuxième ligne à elle seule. */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">
                        {l.nomProduit} <span className="font-normal text-muted">· {l.unite}</span>
                      </p>
                    </div>

                    {/* Quantité décimale */}
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                      <button type="button"
                        onClick={() => updateQte(l.produitId, String(Math.max(0, +(l.quantite - 1).toFixed(3))))}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-surface hover:bg-danger/20 text-xs sm:text-sm font-bold transition-colors shrink-0">
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-8 sm:w-14 bg-transparent text-center font-mono font-bold text-xs sm:text-sm outline-none
                                   border border-border rounded-md px-0.5 sm:px-1 py-0.5 focus:border-accent"
                        value={qteDraft[l.produitId] ?? fmtQte(l.quantite)}
                        onChange={e => handleQteInput(l.produitId, e.target.value)}
                        onBlur={() => commitQteInput(l.produitId)}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                      <button type="button"
                        onClick={() => updateQte(l.produitId, String(+(l.quantite + 1).toFixed(3)))}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-surface hover:bg-success/20 text-xs sm:text-sm font-bold transition-colors shrink-0">
                        +
                      </button>
                    </div>

                    {/* Prix unitaire modifiable */}
                    <div className="w-16 sm:w-24 shrink-0">
                      {editPrix === l.produitId ? (
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            autoFocus
                            className="w-full bg-surface border border-accent rounded-md px-1 sm:px-2 py-0.5 sm:py-1
                                       text-xs sm:text-sm font-mono text-center outline-none text-accent"
                            defaultValue={l.prixUnitaire}
                            onBlur={e => { updatePrix(l.produitId, e.target.value); setEditPrix(null); }}
                            onKeyDown={e => {
                              if (e.key === "Enter") { updatePrix(l.produitId, (e.target as HTMLInputElement).value); setEditPrix(null); }
                              if (e.key === "Escape") setEditPrix(null);
                            }}
                          />
                          <p className="hidden sm:block text-[9px] font-mono text-muted text-center mt-0.5">Entrée pour valider</p>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => setEditPrix(l.produitId)}
                          className={clsx(
                            "w-full text-center font-mono text-[11px] sm:text-sm font-bold px-1 sm:px-2 py-0.5 sm:py-1 rounded-md transition-all whitespace-nowrap",
                            "hover:bg-accent/10 hover:text-accent border border-transparent hover:border-accent/30",
                            l.prixUnitaire !== l.prixRef ? "text-warning" : "text-white"
                          )}
                          title="Cliquer pour modifier le prix">
                          {formatMontant(l.prixUnitaire)}
                          {l.prixUnitaire !== l.prixRef && (
                            <span className="hidden sm:block text-[9px] font-mono opacity-70">
                              Réf: {formatMontant(l.prixRef)}
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Sous-total */}
                    <div className="w-16 sm:w-20 text-right shrink-0">
                      <p className="font-mono font-bold text-[11px] sm:text-sm whitespace-nowrap">{formatMontant(l.sousTotal)}</p>
                    </div>

                    {/* Supprimer — toujours visible sur mobile (pas de survol
                        possible au doigt), masqué jusqu'au survol sur desktop. */}
                    <button type="button"
                      onClick={() => supprimerLigne(l.produitId)}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-md text-muted hover:text-danger hover:bg-danger/10
                                 transition-all text-xs sm:text-sm shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Total + next — le récap "X articles · Y unités" et l'astuce
                  sont superflus sur mobile, où la hauteur manque déjà pour
                  voir le panier lui-même ; ils restent sur desktop. */}
              <div className="p-3 sm:p-4 border-t border-border space-y-2 sm:space-y-3 shrink-0">
                {panier.length > 0 && (
                  <div className="hidden sm:flex items-center justify-between text-sm text-muted font-mono">
                    <span>{panier.length} article{panier.length > 1 ? "s" : ""} · {panier.reduce((s, l) => s + l.quantite, 0).toFixed(2)} unité{panier.reduce((s, l) => s + l.quantite, 0) > 1 ? "s" : ""}</span>
                    <span className="text-xs">Cliquer sur un prix pour le modifier</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted font-mono text-sm">Total</span>
                  <span className="text-2xl font-extrabold font-mono text-accent">{formatMontant(total)}</span>
                </div>
                <button type="button"
                  onClick={() => setStep("paiement")}
                  disabled={panier.length === 0 || !boutiqueId || !sessionOuverte?.session}
                  className="btn-primary w-full justify-center disabled:opacity-50">
                  Continuer → Paiement
                </button>
              </div>
            </div>
          </div>
          </>
        )}

        {/* ── ÉTAPE 2 : PAIEMENT ────────────────────────── */}
        {step === "paiement" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Récap */}
            <div className="bg-surface2 rounded-2xl overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-3">Récapitulatif</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {panier.map(l => (
                    <div key={l.produitId} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-muted2 truncate block">{l.nomProduit}</span>
                        <span className="text-[10px] font-mono text-muted">
                          {fmtQte(l.quantite)} {l.unite} × {formatMontant(l.prixUnitaire)}
                          {l.prixUnitaire !== l.prixRef && (
                            <span className="text-warning ml-1">(prix modifié)</span>
                          )}
                        </span>
                      </div>
                      <span className="font-mono font-semibold shrink-0 ml-3">{formatMontant(l.sousTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between px-4 py-3 border-t border-border">
                <span className="font-bold">Total</span>
                <span className="font-mono font-extrabold text-lg text-accent">{formatMontant(total)}</span>
              </div>
            </div>

            {/* Client + Statut */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Client</label>
                <input className="input" placeholder="Client comptoir"
                  value={client} onChange={e => setClient(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Statut paiement</label>
                <select className="select" value={statut} onChange={e => setStatut(e.target.value)}>
                  <option value="payee">Payée maintenant</option>
                  <option value="en_attente">En attente de paiement</option>
                </select>
              </div>
            </div>

            {/* Employé qui effectue la vente */}
            <div>
              <label className="input-label">Employé responsable de la vente *</label>
              <select className="select" value={employeId} onChange={e => setEmployeId(e.target.value)} required>
                <option value="">Sélectionner un employé...</option>
                {employes.map(e => (
                  <option key={e._id} value={e._id}>
                    {e.prenom} {e.nom} — {e.poste}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode de paiement */}
            <div>
              <label className="input-label">Mode de paiement</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { v: "especes",      icon: "💵", label: "Espèces" },
                  { v: "mobile_money", icon: "📱", label: "Mobile Money" },
                  { v: "virement",     icon: "🏦", label: "Virement" },
                  { v: "cheque",       icon: "📝", label: "Chèque" },
                ].map(m => (
                  <button key={m.v} type="button" onClick={() => setModePaiement(m.v)}
                    className={clsx("flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-xs font-medium transition-all",
                      modePaiement === m.v
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface2 text-muted2 hover:border-border2"
                    )}>
                    <span className="text-xl">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Montant reçu (espèces seulement) */}
            {statut === "payee" && modePaiement === "especes" && (
              <div>
                <label className="input-label">Montant reçu (FCFA)</label>
                <input type="number" min={0} step={PAS_FCFA} className="input text-lg font-bold font-mono"
                  placeholder={String(totalARegler)} value={montantRecu}
                  onChange={e => setMontantRecu(e.target.value)} />
                {Math.abs(totalARegler - total) >= 0.005 && (
                  <p className="mt-1 text-[11px] font-mono text-muted">
                    Total {formatMontant(total)} arrondi à {formatMontant(totalARegler)} (multiple de {PAS_FCFA} F)
                  </p>
                )}
                {montantRecu !== "" && (
                  <div className={clsx(
                    "mt-2 flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-mono",
                    monnaie >= 0
                      ? "bg-success/10 text-success border border-success/20"
                      : "bg-danger/10 text-danger border border-danger/20"
                  )}>
                    <span>{monnaie >= 0 ? "Monnaie à rendre" : "Montant insuffisant"}</span>
                    <span className="font-bold">{formatMontant(Math.abs(monnaie))}</span>
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <div>
              <label className="input-label">Note</label>
              <input className="input" placeholder="Observation, remarque..."
                value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                ⚠ {error}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("panier")} className="btn-ghost flex-1 justify-center">
                ← Retour au panier
              </button>
              <button type="button"
                onClick={handleSubmit}
                disabled={
                  loading || !employeId ||
                  (modePaiement === "especes" && statut === "payee" && montantRecu !== "" && monnaie < 0)
                }
                className="btn-primary flex-1 justify-center disabled:opacity-60">
                {loading ? "Enregistrement..." : "✓ Valider la vente"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Confirmation de fermeture — boîte de dialogue maison plutôt qu'un
        window.confirm() natif, qui peut rester invisible dans certains
        navigateurs mobiles ou en PWA installée. */}
    {confirmClose && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmClose(false)} />
        <div className="relative w-full max-w-sm card p-5 space-y-4 animate-slide-up">
          <h3 className="font-bold text-base">Fermer sans enregistrer ?</h3>
          <p className="text-sm text-muted">
            Le panier ({panier.length} article{panier.length > 1 ? "s" : ""}) sera perdu si tu fermes maintenant.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmClose(false)}
              className="btn-primary flex-1 justify-center">
              Continuer la vente
            </button>
            <button type="button" onClick={() => { setConfirmClose(false); onClose(); }}
              className="btn-danger flex-1 justify-center">
              Fermer
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
