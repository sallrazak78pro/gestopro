// app/(dashboard)/parametres/page.tsx
"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

const PAYS = [
  { code: "CI", nom: "Côte d'Ivoire" }, { code: "SN", nom: "Sénégal" },
  { code: "ML", nom: "Mali" },          { code: "BF", nom: "Burkina Faso" },
  { code: "GN", nom: "Guinée" },        { code: "CM", nom: "Cameroun" },
  { code: "TG", nom: "Togo" },          { code: "BJ", nom: "Bénin" },
  { code: "NE", nom: "Niger" },         { code: "CD", nom: "RD Congo" },
  { code: "MA", nom: "Maroc" },         { code: "DZ", nom: "Algérie" },
  { code: "TN", nom: "Tunisie" },       { code: "FR", nom: "France" },
  { code: "AU", nom: "Autre" },
];

type Tab = "entreprise" | "securite" | "plan" | "signaler";

export default function ParametresPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAdmin = ["admin", "superadmin"].includes(role);

  const [tab, setTab]           = useState<Tab>("entreprise");
  const [tenant, setTenant]     = useState<any>(null);
  const [meta, setMeta]         = useState({ nbUsers: 0, nbBoutiques: 0 });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState("");
  const [error, setError]       = useState("");

  // Entreprise form
  const [entForm, setEntForm] = useState({ nom: "", email: "", telephone: "", ville: "", pays: "CI" });
  const [gestionStockStricte, setGestionStockStricte] = useState(false);
  const [mouvementsActifs,    setMouvementsActifs]    = useState(true);

  // Sécurité form
  const [secForm, setSecForm] = useState({ ancienPassword: "", nouveauPassword: "", confirmer: "" });
  const [showPwd, setShowPwd] = useState(false);

  // Signaler un problème
  const [sigForm, setSigForm] = useState({ type: "bug", description: "" });
  const [sigSaving, setSigSaving] = useState(false);

  useEffect(() => {
    fetch("/api/parametres")
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setTenant(j.data);
          setMeta(j.meta);
          setEntForm({
            nom:       j.data.nom       || "",
            email:     j.data.email     || "",
            telephone: j.data.telephone || "",
            ville:     j.data.ville     || "",
            pays:      j.data.pays      || "CI",
          });
          setGestionStockStricte(j.data.gestionStockStricte ?? false);
          setMouvementsActifs(j.data.mouvementsActifs ?? true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function flash(msg: string, isErr = false) {
    if (isErr) { setError(msg); setSuccess(""); }
    else       { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 4000);
  }

  async function saveEntreprise(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res  = await fetch("/api/parametres", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entForm, gestionStockStricte, mouvementsActifs }),
    });
    const json = await res.json();
    setSaving(false);
    json.success ? flash("Informations mises à jour !") : flash(json.message, true);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (secForm.nouveauPassword !== secForm.confirmer) {
      flash("Les mots de passe ne correspondent pas.", true); return;
    }
    setSaving(true);
    const res  = await fetch("/api/parametres/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ancienPassword: secForm.ancienPassword, nouveauPassword: secForm.nouveauPassword }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      flash("Mot de passe modifié avec succès !");
      setSecForm({ ancienPassword: "", nouveauPassword: "", confirmer: "" });
    } else flash(json.message, true);
  }

  async function signalerProbleme(e: React.FormEvent) {
    e.preventDefault();
    if (!sigForm.description.trim()) return;
    setSigSaving(true);
    const res = await fetch("/api/erreurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: sigForm.type,
        description: sigForm.description,
        page: typeof window !== "undefined" ? window.location.pathname : "/parametres",
      }),
    });
    const json = await res.json();
    setSigSaving(false);
    if (json.success) {
      flash("Problème signalé avec succès. Merci !");
      setSigForm({ type: "bug", description: "" });
    } else {
      flash(json.message || "Erreur lors de l'envoi.", true);
    }
  }

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "entreprise", icon: "🏢", label: "Mon entreprise" },
    { id: "securite",   icon: "🔒", label: "Sécurité" },
    { id: "plan",       icon: "📋", label: "Mon plan" },
    { id: "signaler",   icon: "🐛", label: "Signaler un problème" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted font-mono text-sm gap-3">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Chargement...
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">

      {/* Flash messages */}
      {success && (
        <div className="bg-success/10 border border-success/30 text-success text-sm px-5 py-3 rounded-xl flex items-center gap-2">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-5 py-3 rounded-xl flex items-center gap-2">
          ⚠ {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-surface2 p-1.5 rounded-2xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              tab === t.id
                ? "bg-surface text-white shadow-card border border-border"
                : "text-muted hover:text-white"
            )}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB : ENTREPRISE ──────────────────────────── */}
      {tab === "entreprise" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Informations de l&apos;entreprise</h2>
              <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
                Visible dans vos factures et rapports
              </p>
            </div>
            {tenant && (
              <div className="flex items-center gap-2">
                <span className="badge-blue font-mono text-xs">{tenant.slug}</span>
                <span className={`badge-green`}>{tenant.plan}</span>
              </div>
            )}
          </div>

          <form onSubmit={saveEntreprise} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="input-label">Nom de l&apos;entreprise *</label>
                <input className="input" value={entForm.nom}
                  onChange={e => setEntForm(f => ({ ...f, nom: e.target.value }))}
                  disabled={!isAdmin} required />
              </div>
              <div>
                <label className="input-label">Email de contact</label>
                <input type="email" className="input" value={entForm.email}
                  onChange={e => setEntForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!isAdmin} />
              </div>
              <div>
                <label className="input-label">Téléphone</label>
                <input className="input" value={entForm.telephone}
                  onChange={e => setEntForm(f => ({ ...f, telephone: e.target.value }))}
                  disabled={!isAdmin} />
              </div>
              <div>
                <label className="input-label">Pays</label>
                <select className="select" value={entForm.pays}
                  onChange={e => setEntForm(f => ({ ...f, pays: e.target.value }))}
                  disabled={!isAdmin}>
                  {PAYS.map(p => <option key={p.code} value={p.code}>{p.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Ville</label>
                <input className="input" value={entForm.ville}
                  onChange={e => setEntForm(f => ({ ...f, ville: e.target.value }))}
                  disabled={!isAdmin} />
              </div>
            </div>

            {!isAdmin && (
              <p className="text-xs font-mono text-warning bg-warning/10 border border-warning/20 px-4 py-2.5 rounded-lg">
                ⚠ Seul l&apos;administrateur peut modifier ces informations.
              </p>
            )}

            {isAdmin && (
              <>
                {/* Toggle gestion stock */}
                <div className="border rounded-2xl p-5" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--color-fg)" }}>
                        📦 Contrôle strict du stock
                      </p>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {gestionStockStricte
                          ? "Activé — une vente est bloquée si le stock est insuffisant."
                          : "Désactivé — les ventes sont possibles même si le stock est à zéro ou non configuré."}
                      </p>
                    </div>
                    {/* Toggle switch */}
                    <button type="button"
                      onClick={() => setGestionStockStricte(!gestionStockStricte)}
                      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                        gestionStockStricte ? "bg-accent" : "bg-surface3"
                      }`}
                      style={{ border: "1px solid var(--color-border2)" }}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        gestionStockStricte ? "translate-x-6" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>
                  {!gestionStockStricte && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-mono text-warning bg-warning/5 border border-warning/20 rounded-xl px-3 py-2">
                      <span>⚠</span>
                      <span>Le stock ne sera pas déduit automatiquement lors des ventes si les produits ne sont pas en stock.</span>
                    </div>
                  )}
                </div>

                {/* Toggle mouvements de marchandise */}
                <div className="border rounded-2xl p-5" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--color-fg)" }}>
                        🔄 Mouvements de marchandise
                      </p>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {mouvementsActifs
                          ? "Activé — transferts de stock entre boutiques et dépôt disponibles."
                          : "Désactivé — le menu Mouvements est masqué. Utile si vous n'avez qu'une seule boutique."}
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => setMouvementsActifs(!mouvementsActifs)}
                      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
                        mouvementsActifs ? "bg-accent" : "bg-surface3"
                      }`}
                      style={{ border: "1px solid var(--color-border2)" }}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        mouvementsActifs ? "translate-x-6" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                    {saving ? "Enregistrement..." : "✓ Sauvegarder"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* ── TAB : SÉCURITÉ ──────────────────────────────── */}
      {tab === "securite" && (
        <div className="space-y-4">

          {/* Profil actuel */}
          <div className="card p-5">
            <h3 className="text-sm font-bold mb-4">Mon profil</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-accent flex items-center justify-center text-xl font-extrabold text-white">
                {session?.user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold">{session?.user?.name}</p>
                <p className="text-sm text-muted">{session?.user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={clsx(
                    "badge text-[10px]",
                    role === "admin" ? "badge-red" : role === "gestionnaire" ? "badge-blue" : "badge-green"
                  )}>{role}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Changer le mot de passe */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Changer le mot de passe</h3>
            </div>
            <form onSubmit={changePassword} className="p-6 space-y-4">
              <div>
                <label className="input-label">Mot de passe actuel *</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} className="input pr-12"
                    placeholder="••••••••"
                    value={secForm.ancienPassword}
                    onChange={e => setSecForm(f => ({ ...f, ancienPassword: e.target.value }))}
                    required />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white text-sm">
                    {showPwd ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Nouveau mot de passe *</label>
                  <input type={showPwd ? "text" : "password"} className="input"
                    placeholder="••••••••" minLength={6}
                    value={secForm.nouveauPassword}
                    onChange={e => setSecForm(f => ({ ...f, nouveauPassword: e.target.value }))}
                    required />
                </div>
                <div>
                  <label className="input-label">Confirmer *</label>
                  <input type={showPwd ? "text" : "password"} className="input"
                    placeholder="••••••••"
                    value={secForm.confirmer}
                    onChange={e => setSecForm(f => ({ ...f, confirmer: e.target.value }))} required />
                  {secForm.confirmer && secForm.nouveauPassword !== secForm.confirmer && (
                    <p className="text-[11px] font-mono text-danger mt-1">Ne correspondent pas</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit"
                  disabled={saving || !secForm.ancienPassword || secForm.nouveauPassword.length < 6 || secForm.nouveauPassword !== secForm.confirmer}
                  className="btn-primary disabled:opacity-50">
                  {saving ? "Modification..." : "🔒 Changer le mot de passe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB : SIGNALER UN PROBLÈME ─────────────────── */}
      {tab === "signaler" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Signaler un problème</h2>
              <p className="text-[11px] font-mono text-muted mt-0.5 uppercase tracking-widest">
                Votre retour aide à améliorer l&apos;application
              </p>
            </div>
            <span className="text-2xl">🐛</span>
          </div>
          <form onSubmit={signalerProbleme} className="p-6 space-y-5">
            <div>
              <label className="input-label">Type de problème *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {[
                  { value: "bug",       icon: "🐛", label: "Bug" },
                  { value: "donnees",   icon: "📊", label: "Données incorrectes" },
                  { value: "affichage", icon: "🖥️", label: "Affichage" },
                  { value: "autre",     icon: "💬", label: "Autre" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSigForm(f => ({ ...f, type: opt.value }))}
                    className={clsx(
                      "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 text-sm font-semibold transition-all",
                      sigForm.type === opt.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface2 text-muted hover:border-border2 hover:text-fg"
                    )}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-xs text-center leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label">Description du problème *</label>
              <textarea
                className="input min-h-[120px] resize-y"
                placeholder="Décrivez le problème en détail : ce que vous faisiez, ce qui s'est passé, ce que vous attendiez..."
                value={sigForm.description}
                onChange={e => setSigForm(f => ({ ...f, description: e.target.value }))}
                required
                minLength={10}
              />
              <p className="text-[11px] font-mono text-muted mt-1">
                Minimum 10 caractères · {sigForm.description.length} saisi{sigForm.description.length > 1 ? "s" : ""}
              </p>
            </div>

            <div className="bg-surface2 rounded-2xl p-4 text-xs font-mono text-muted space-y-1">
              <p className="font-semibold text-muted2">ℹ Informations envoyées automatiquement :</p>
              <p>· Votre nom et rôle</p>
              <p>· La page où vous vous trouvez</p>
              <p>· La date et l&apos;heure</p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sigSaving || sigForm.description.trim().length < 10}
                className="btn-primary disabled:opacity-50"
              >
                {sigSaving ? "Envoi en cours..." : "📨 Envoyer le signalement"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB : PLAN ──────────────────────────────────── */}
      {tab === "plan" && tenant && (
        <div className="space-y-4">

          {/* Plan actuel */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold mb-1">Plan actuel</h3>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-extrabold capitalize text-accent">{tenant.plan}</span>
                  <span className="badge-green">Actif</span>
                </div>
              </div>
              <div className="text-4xl">
                {tenant.plan === "gratuit" ? "🆓" : tenant.plan === "pro" ? "⚡" : "🏆"}
              </div>
            </div>

            {/* Utilisation */}
            <div className="space-y-3">
              <UsageBar label="Utilisateurs" current={meta.nbUsers} max={tenant.nbUsersMax} color="#00d4ff" />
              <UsageBar label="Boutiques" current={meta.nbBoutiques} max={tenant.nbBoutiquesMax} color="#7c3aed" />
            </div>
          </div>

          {/* Plans disponibles */}
          <div className="card p-6">
            <h3 className="text-sm font-bold mb-4">Plans disponibles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { nom: "Gratuit",    icon: "🆓", prix: "0 F/mois",      users: 10,  boutiques: 5,  color: "#64748b" },
                { nom: "Pro",        icon: "⚡", prix: "Bientôt",       users: 50,  boutiques: 20, color: "#00d4ff" },
                { nom: "Enterprise", icon: "🏆", prix: "Sur mesure",    users: 999, boutiques: 99, color: "#f59e0b" },
              ].map(p => (
                <div key={p.nom} className={clsx(
                  "rounded-2xl border-2 p-5 text-center transition-all",
                  tenant.plan === p.nom.toLowerCase()
                    ? "border-accent/60 bg-accent/5"
                    : "border-border bg-surface2"
                )}>
                  <div className="text-3xl mb-2">{p.icon}</div>
                  <h4 className="font-bold mb-1">{p.nom}</h4>
                  <p className="text-lg font-mono font-extrabold mb-3"
                    style={{ color: p.color }}>{p.prix}</p>
                  <div className="space-y-1 text-xs text-muted font-mono">
                    <p>👤 {p.users === 999 ? "Illimité" : p.users} utilisateurs</p>
                    <p>🏪 {p.boutiques === 99 ? "Illimité" : p.boutiques} boutiques</p>
                  </div>
                  {tenant.plan === p.nom.toLowerCase() ? (
                    <div className="mt-4 text-xs font-mono text-success">✓ Plan actuel</div>
                  ) : (
                    <button className="mt-4 btn-ghost btn-sm w-full justify-center opacity-50 cursor-not-allowed">
                      Bientôt disponible
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Usage Bar ──────────────────────────────────────────────────
function UsageBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const pct = Math.min((current / max) * 100, 100);
  const danger = pct >= 90;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-mono text-muted">{label}</span>
        <span className={clsx("font-mono font-bold", danger ? "text-danger" : "text-muted2")}>
          {current} / {max}
        </span>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: danger ? "#ef4444" : color }}
        />
      </div>
    </div>
  );
}
