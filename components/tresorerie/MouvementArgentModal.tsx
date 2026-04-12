// components/tresorerie/MouvementArgentModal.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";

interface Boutique { _id: string; nom: string; estPrincipale: boolean; }
interface Tiers    { _id: string; nom: string; telephone: string; solde: number; }

const TYPES = [
  {
    value: "versement_boutique",
    icon: "💸", label: "Versement à la boutique principale",
    desc: "Une boutique secondaire envoie son argent à la boutique principale",
    color: "border-success/50 bg-success/5", flux: "sortie",
    roles: ["all"],
  },
  {
    value: "versement_banque",
    icon: "🏦", label: "Versement à la banque",
    desc: "La boutique principale dépose de l'argent en banque",
    color: "border-blue-500/50 bg-blue-500/5", flux: "sortie",
    roles: ["admin", "superadmin"],
  },
  {
    value: "avance_caisse",
    icon: "🔄", label: "Avance de caisse",
    desc: "La boutique principale envoie une avance à une boutique secondaire",
    color: "border-orange-500/50 bg-orange-500/5", flux: "entree",
    roles: ["admin", "superadmin"],
  },
  {
    value: "remboursement",
    icon: "↩️", label: "Remboursement",
    desc: "Une boutique secondaire rembourse une avance reçue",
    color: "border-accent/50 bg-accent/5", flux: "sortie",
    roles: ["all"],
  },
  {
    value: "depense",
    icon: "💳", label: "Dépense",
    desc: "Salaire, loyer, frais divers d'une boutique",
    color: "border-danger/50 bg-danger/5", flux: "sortie",
    roles: ["all"],
  },
  {
    value: "achat_direct",
    icon: "🛍️", label: "Achat direct de marchandise",
    desc: "Achat local occasionnel — boutique secondaire en manque de stock",
    color: "border-warning/50 bg-warning/5", flux: "sortie",
    roles: ["all"],
  },
  {
    value: "depot_tiers",
    icon: "👤", label: "Dépôt d'un tiers",
    desc: "Une personne extérieure dépose son argent dans une boutique",
    color: "border-purple-500/50 bg-purple-500/5", flux: "entree",
    roles: ["all"],
  },
  {
    value: "retrait_tiers",
    icon: "💼", label: "Retrait d'un tiers",
    desc: "Une personne retire son argent de son compte",
    color: "border-warning/50 bg-warning/5", flux: "sortie",
    roles: ["all"],
  },
];

export default function MouvementArgentModal({
  defaultType, onClose, onSaved
}: { defaultType: string; onClose: () => void; onSaved: () => void }) {
  const [step, setStep]           = useState<"type" | "details">(defaultType ? "details" : "type");
  const [type, setType]           = useState(defaultType || "");
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [tiers, setTiers]         = useState<Tiers[]>([]);
  const [tiersSearch, setTiersSearch] = useState("");
  const [form, setForm]           = useState({
    boutiqueId: "", boutiqueDestinationId: "", montant: "",
    categorieDepense: "", tiersId: "", motif: "", avanceRef: "",
    banqueNom: "",
  });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [soldeCaisse, setSoldeCaisse] = useState<number | null>(null);
  const [soldeLoading, setSoldeLoading] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/boutiques").then(r => r.json()).then(j => j.success && setBoutiques(j.data.filter((b: any) => b.type === "boutique")));
  }, []);

  useEffect(() => {
    if (!["depot_tiers", "retrait_tiers"].includes(type)) return;
    const params = new URLSearchParams();
    if (tiersSearch) params.set("search", tiersSearch);
    if (form.boutiqueId) params.set("boutique", form.boutiqueId);
    fetch(`/api/tiers?${params}`).then(r => r.json()).then(j => j.success && setTiers(j.data));
  }, [type, tiersSearch, form.boutiqueId]);

  // Charger le solde de la boutique pour les types qui nécessitent une vérification
  useEffect(() => {
    const typesAvecControle = ["versement_boutique", "versement_banque", "depense", "achat_direct", "remboursement"];
    if (!form.boutiqueId || !typesAvecControle.includes(type)) { setSoldeCaisse(null); return; }
    setSoldeLoading(true);
    fetch(`/api/tresorerie/solde?boutiqueId=${form.boutiqueId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setSoldeCaisse(j.data.soldeCaisse); })
      .finally(() => setSoldeLoading(false));
  }, [form.boutiqueId, type]);

  const selectedType  = TYPES.find(t => t.value === type);
  const principale    = boutiques.find(b => b.estPrincipale);
  const selectedTiers = tiers.find(t => t._id === form.tiersId);

  // Logique boutique source/dest selon le type
  const boutiqueSrcLabel: Record<string, string> = {
    versement_boutique: "Boutique qui verse (secondaire)",
    versement_banque:   "Boutique principale (qui envoie en banque)",
    avance_caisse:      "Boutique qui reçoit l'avance (secondaire)",
    remboursement:      "Boutique qui rembourse",
    depense:            "Boutique qui dépense",
    achat_direct:       "Boutique qui achète",
    depot_tiers:        "Boutique du dépôt",
    retrait_tiers:      "Boutique du retrait",
  };
  const showDestination = ["versement_boutique", "avance_caisse", "remboursement"].includes(type);
  const showBanque      = type === "versement_banque";
  const showCategorie   = type === "depense";
  const showAchat       = type === "achat_direct";
  const showTiers       = ["depot_tiers", "retrait_tiers"].includes(type);
  const showAvanceRef   = type === "remboursement";

  const { submit } = useOfflineQueue();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const montantFmt = new Intl.NumberFormat("fr-FR").format(parseFloat(form.montant) || 0);
    const result = await submit({
      endpoint: "/api/tresorerie",
      method:   "POST",
      body: {
        type,
        boutiqueId: form.boutiqueId,
        boutiqueDestinationId: showDestination ? form.boutiqueDestinationId : undefined,
        montant: parseFloat(form.montant),
        categorieDepense: (showCategorie || showAchat) ? (showAchat ? "achat_marchandise" : form.categorieDepense) : undefined,
        banqueNom: showBanque ? form.banqueNom : undefined,
        tiersId: showTiers ? form.tiersId : undefined,
        motif: form.motif,
        avanceRef: showAvanceRef ? form.avanceRef : undefined,
      },
      label:  `${selectedType?.label ?? type} — ${montantFmt} F`,
      module: "tresorerie",
    });
    setLoading(false);
    if (!result.ok) { setError((result as any).error ?? "Une erreur est survenue."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card animate-slide-up flex flex-col max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-lg font-bold">Mouvement d'argent</h2>
            <div className="flex items-center gap-2 mt-1">
              {["type", "details"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-6 h-px bg-border" />}
                  <span className={clsx("flex items-center gap-1.5 text-xs font-mono",
                    step === s ? "text-accent" : "text-muted")}>
                    <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      step === s ? "bg-accent text-bg" : "bg-surface2 text-muted")}>{i + 1}</span>
                    {s === "type" ? "Type" : "Détails"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {/* STEP 1 — type */}
        {step === "type" && (
          <div className="p-5 space-y-2.5">
            <p className="text-sm text-muted mb-3">Quel type d'opération veux-tu enregistrer ?</p>
            {TYPES.map(t => (
              <button key={t.value} type="button"
                onClick={() => { setType(t.value); setStep("details"); }}
                className={clsx("w-full flex items-start gap-4 px-4 py-3.5 rounded-xl border-2 text-left",
                  "transition-all hover:-translate-y-0.5", t.color)}>
                <span className="text-2xl shrink-0">{t.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-sm">{t.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{t.desc}</p>
                </div>
                <div className={clsx("text-[10px] font-mono font-bold mt-1 shrink-0",
                  t.flux === "entree" ? "text-success" : "text-danger")}>
                  {t.flux === "entree" ? "▲ Entrée" : "▼ Sortie"}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP 2 — détails */}
        {step === "details" && selectedType && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Type badge */}
            <div className={clsx("flex items-center gap-3 px-4 py-3 rounded-xl border-2", selectedType.color)}>
              <span className="text-2xl">{selectedType.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-sm">{selectedType.label}</p>
                <p className="text-[11px] opacity-75">{selectedType.desc}</p>
              </div>
              {!defaultType && (
                <button type="button" onClick={() => setStep("type")}
                  className="text-xs font-mono underline opacity-70 hover:opacity-100 shrink-0">Changer</button>
              )}
            </div>

            {/* Boutique source */}
            <div>
              <label className="input-label">{boutiqueSrcLabel[type]} *</label>
              <select className="select" value={form.boutiqueId}
                onChange={e => set("boutiqueId", e.target.value)} required>
                <option value="">Choisir une boutique...</option>
                {boutiques.map(b => (
                  <option key={b._id} value={b._id}>
                    {b.nom}{b.estPrincipale ? " ★ (Principale)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Solde de caisse disponible ─────────────────── */}
            {soldeCaisse !== null && !soldeLoading && ["versement_boutique","versement_banque","depense","achat_direct","remboursement"].includes(type) && (
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border font-mono text-sm
                ${form.montant && parseFloat(form.montant) > soldeCaisse
                  ? "bg-danger/10 border-danger/30 text-danger"
                  : "bg-success/10 border-success/20 text-success"}`}>
                <span className="text-xs opacity-80">Solde caisse disponible</span>
                <span className="font-bold">{new Intl.NumberFormat("fr-FR").format(soldeCaisse)} F</span>
              </div>
            )}
            {soldeLoading && <p className="text-xs font-mono text-muted animate-pulse">Calcul du solde...</p>}

            {/* Boutique destination (versement boutique, avance, remboursement) */}
            {showDestination && (
              <div>
                <label className="input-label">
                  {type === "versement_boutique" ? "Boutique principale (qui reçoit) *"
                   : type === "avance_caisse"    ? "Boutique secondaire qui reçoit l'avance *"
                   : "Boutique remboursée *"}
                </label>
                <select className="select" value={form.boutiqueDestinationId}
                  onChange={e => set("boutiqueDestinationId", e.target.value)} required>
                  <option value="">Choisir...</option>
                  {boutiques
                    .filter(b => b._id !== form.boutiqueId)
                    .map(b => (
                      <option key={b._id} value={b._id}>
                        {b.nom}{b.estPrincipale ? " ★ (Principale)" : ""}
                      </option>
                    ))}
                </select>
                {type === "versement_boutique" && principale && (
                  <p className="text-[10px] font-mono text-success mt-1">
                    ★ Boutique principale : {principale.nom}
                  </p>
                )}
              </div>
            )}

            {/* Banque (versement_banque) */}
            {showBanque && (
              <div>
                <label className="input-label">Nom de la banque *</label>
                <input className="input" placeholder="Ex: BGFI, UBA, Crédit du Congo..."
                  value={form.banqueNom}
                  onChange={e => set("banqueNom", e.target.value)} required />
                <p className="text-[10px] font-mono text-muted mt-1">
                  Ce montant sort de la boutique principale et est déposé en banque
                </p>
              </div>
            )}

            {/* Achat direct marchandise */}
            {showAchat && (
              <div className="bg-warning/5 border border-warning/20 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-warning mb-1">⚠️ Achat local occasionnel</p>
                <p className="text-xs text-muted">
                  Réservé aux achats urgents quand le stock manque. Précisez le détail dans le motif.
                  N'oubliez pas d'ajuster le stock manuellement après.
                </p>
              </div>
            )}

            {/* Catégorie dépense */}
            {showCategorie && (
              <div>
                <label className="input-label">Catégorie de dépense *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "salaire", icon: "💼", label: "Salaire" },
                    { v: "loyer",   icon: "🏠", label: "Loyer" },
                    { v: "divers",  icon: "📌", label: "Divers" },
                  ].map(c => (
                    <button key={c.v} type="button" onClick={() => set("categorieDepense", c.v)}
                      className={clsx("flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-medium transition-all",
                        form.categorieDepense === c.v
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface2 text-muted2 hover:border-border2")}>
                      <span className="text-xl">{c.icon}</span>{c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tiers — dépôt / retrait */}
            {showTiers && (
              <div>
                <label className="input-label">
                  {type === "depot_tiers" ? "Personne qui dépose *" : "Personne qui retire *"}
                </label>
                <input className="input mb-2" placeholder="🔍  Rechercher par nom ou téléphone..."
                  value={tiersSearch} onChange={e => setTiersSearch(e.target.value)} />

                {tiers.length > 0 && !form.tiersId && (
                  <div className="bg-surface2 border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {tiers.map(t => (
                      <button key={t._id} type="button"
                        onClick={() => { set("tiersId", t._id); setTiersSearch(t.nom); }}
                        className="w-full flex items-center justify-between px-4 py-2.5
                                   hover:bg-surface border-b border-border/50 last:border-0 text-left transition-colors">
                        <div>
                          <p className="text-sm font-semibold">{t.nom}</p>
                          {t.telephone && <p className="text-[10px] font-mono text-muted">{t.telephone}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold text-accent">{new Intl.NumberFormat("fr-FR").format(t.solde)} F</p>
                          <p className="text-[9px] text-muted font-mono">Solde actuel</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Créer un nouveau tiers rapidement */}
                {tiers.length === 0 && tiersSearch && form.boutiqueId && (
                  <NouveauTiersQuick
                    nom={tiersSearch}
                    boutiqueId={form.boutiqueId}
                    onCreated={(id, nom) => { set("tiersId", id); setTiersSearch(nom); }}
                  />
                )}

                {/* Tiers sélectionné */}
                {selectedTiers && (
                  <div className={clsx("flex items-center justify-between border-2 rounded-xl px-4 py-3",
                    type === "retrait_tiers" && selectedTiers.solde < parseFloat(form.montant || "0")
                      ? "border-danger/40 bg-danger/5"
                      : "border-accent/40 bg-accent/5")}>
                    <div>
                      <p className="text-sm font-bold">{selectedTiers.nom}</p>
                      <p className="text-xs font-mono text-muted mt-0.5">
                        Solde: <span className="text-accent font-bold">
                          {new Intl.NumberFormat("fr-FR").format(selectedTiers.solde)} F
                        </span>
                      </p>
                    </div>
                    <button type="button" onClick={() => { set("tiersId", ""); setTiersSearch(""); }}
                      className="text-muted hover:text-danger text-lg transition-colors">✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Référence avance */}
            {showAvanceRef && (
              <div>
                <label className="input-label">Référence de l'avance remboursée</label>
                <input className="input" placeholder="ex: AVN-2026-0001"
                  value={form.avanceRef} onChange={e => set("avanceRef", e.target.value)} />
              </div>
            )}

            {/* Montant */}
            <div>
              <label className="input-label">Montant (FCFA) *</label>
              <div className="relative">
                <input type="number" min={1} className="input pr-14 text-lg font-bold font-mono"
                  placeholder="0" value={form.montant}
                  onChange={e => set("montant", e.target.value)} required />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono text-muted">F CFA</span>
              </div>
              {/* Alerte solde insuffisant pour retrait tiers */}
              {type === "retrait_tiers" && selectedTiers && form.montant && (
                parseFloat(form.montant) > selectedTiers.solde ? (
                  <p className="text-xs font-mono text-danger mt-1">
                    ⚠ Solde insuffisant — disponible : {new Intl.NumberFormat("fr-FR").format(selectedTiers.solde)} F
                  </p>
                ) : (
                  <p className="text-xs font-mono text-success mt-1">
                    ✓ Solde après retrait : {new Intl.NumberFormat("fr-FR").format(selectedTiers.solde - parseFloat(form.montant))} F
                  </p>
                )
              )}
            </div>

            {/* Motif */}
            <div>
              <label className="input-label">Motif / Observation</label>
              <input className="input" value={form.motif} onChange={e => set("motif", e.target.value)}
                placeholder={
                  type === "depense" ? "ex: Salaire mars 2026, Loyer boutique..."
                  : type === "versement_hebdo" ? "ex: Versement semaine du 24 mars"
                  : type === "avance_caisse" ? "ex: Achat marchandise urgent"
                  : "Observation optionnelle..."
                } />
            </div>

            {/* Récap */}
            {form.montant && form.boutiqueId && (
              <div className="bg-surface2 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Récapitulatif</p>
                <div className="flex justify-between">
                  <span className="text-muted">Opération</span>
                  <span className="font-semibold">{selectedType.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Boutique</span>
                  <span className="font-semibold">{boutiques.find(b => b._id === form.boutiqueId)?.nom}</span>
                </div>
                {form.boutiqueDestinationId && (
                  <div className="flex justify-between">
                    <span className="text-muted">Destination</span>
                    <span className="font-semibold">{boutiques.find(b => b._id === form.boutiqueDestinationId)?.nom}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-muted">Montant</span>
                  <span className={clsx("font-mono font-extrabold",
                    selectedType.flux === "entree" ? "text-success" : "text-danger")}>
                    {selectedType.flux === "entree" ? "+" : "−"}{new Intl.NumberFormat("fr-FR").format(parseFloat(form.montant))} F
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">
                ⚠ {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => defaultType ? onClose() : setStep("type")}
                className="btn-ghost flex-1 justify-center">← Retour</button>
              <button type="submit"
                disabled={
                  loading || !form.boutiqueId || !form.montant ||
                  (showCategorie && !form.categorieDepense) ||
                  (showTiers && !form.tiersId) ||
                  (showDestination && !form.boutiqueDestinationId) ||
                  (type === "retrait_tiers" && selectedTiers && parseFloat(form.montant) > selectedTiers.solde) ||
                  (soldeCaisse !== null && !!form.montant && parseFloat(form.montant) > soldeCaisse &&
                   ["versement_hebdo", "depense", "remboursement"].includes(type))
                }
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                {loading ? "Enregistrement..." : "✓ Valider l'opération"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Création rapide d'un tiers ─────────────────────────────────
function NouveauTiersQuick({ nom, boutiqueId, onCreated }: {
  nom: string; boutiqueId: string; onCreated: (id: string, nom: string) => void;
}) {
  const [tel, setTel]     = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const res = await fetch("/api/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone: tel, boutique: boutiqueId }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.success) onCreated(json.data._id, json.data.nom);
  }

  return (
    <div className="border border-dashed border-border2 rounded-xl px-4 py-3 mt-2 space-y-2">
      <p className="text-xs font-mono text-accent">Nouveau compte tiers : <strong>{nom}</strong></p>
      <input className="input" placeholder="Téléphone (optionnel)"
        value={tel} onChange={e => setTel(e.target.value)} />
      <button type="button" onClick={create} disabled={loading}
        className="btn-primary btn-sm w-full justify-center disabled:opacity-60">
        {loading ? "Création..." : "+ Créer ce compte"}
      </button>
    </div>
  );
}
