// app/(dashboard)/caisse/[id]/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import PrintButton from "@/components/ui/PrintButton";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const MODE_ICON: Record<string, string> = {
  especes: "💵", mobile_money: "📱", virement: "🏦", cheque: "📝",
};
const TYPE_CONFIG: Record<string, { label: string; icon: string; flux: "entree" | "sortie" }> = {
  versement_hebdo: { label: "Versement hebdo",  icon: "💰", flux: "sortie" },
  avance_caisse:   { label: "Avance reçue",      icon: "🏦", flux: "entree" },
  remboursement:   { label: "Remboursement",     icon: "↩️", flux: "entree" },
  depense:         { label: "Dépense",           icon: "💸", flux: "sortie" },
  depot_tiers:     { label: "Dépôt tiers",       icon: "👤", flux: "entree" },
  retrait_tiers:   { label: "Retrait tiers",     icon: "💼", flux: "sortie" },
};

export default function RapportCaissePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions-caisse/${id}`)
      .then(r => r.json())
      .then(j => j.success && setData(j.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted font-mono text-sm gap-3">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Chargement du rapport...
    </div>
  );
  if (!data) return <div className="text-center py-20 text-muted font-mono">Rapport introuvable</div>;

  const { session, ventes, mouvements } = data;
  const isFermee = session.statut === "fermee";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost btn-sm">← Retour</button>
        <div className="ml-auto">
          <PrintButton href={`/print/caisse/${id}`} label="🖨️ Rapport PDF" />
        </div>
      </div>

      {/* En-tête rapport */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold tracking-tight">Rapport de caisse</h1>
              <span className={isFermee ? "badge-blue" : "badge-green"}>
                {isFermee ? "✓ Fermée" : "🟢 En cours"}
              </span>
            </div>
            <p className="text-sm text-muted2">{session.boutique?.nom}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Ouverture",      value: new Date(session.dateOuverture).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
            { label: "Fermeture",      value: session.dateFermeture ? new Date(session.dateFermeture).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
            { label: "Ouvert par",     value: session.ouvertPar?.nom },
            { label: "Fermé par",      value: session.ferméPar?.nom || "—" },
          ].map((info, i) => (
            <div key={i} className="bg-surface2 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">{info.label}</p>
              <p className="text-sm font-semibold">{info.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bilan financier */}
      <div className="card p-6">
        <h2 className="card-title mb-4">Bilan financier</h2>
        <div className="space-y-2 mb-5">
          {[
            { label: "Fond d'ouverture",  value: session.fondOuverture,   sign: "",  color: "text-muted2" },
            { label: "Total ventes",      value: session.totalVentes,      sign: "+", color: "text-success" },
            { label: "Entrées d'argent",  value: session.totalEntrees,     sign: "+", color: "text-success" },
            { label: "Sorties d'argent",  value: session.totalSorties,     sign: "−", color: "text-danger" },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/50">
              <span className="text-sm text-muted2">{row.label}</span>
              <span className={clsx("font-mono font-semibold", row.color)}>
                {row.sign} {fmt(row.value)} F
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 mt-2">
            <span className="font-bold">Montant attendu</span>
            <span className="font-mono font-extrabold text-xl text-accent">{fmt(session.montantAttendu)} F</span>
          </div>
        </div>

        {/* Comparaison si fermée */}
        {isFermee && (
          <>
            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-sm font-bold mb-3">Comptage réel vs Attendu</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { icon: "💵", label: "Espèces",      attendu: session.ventesEspeces,     reel: session.montantReelEspeces },
                  { icon: "📱", label: "Mobile Money", attendu: session.ventesMobileMoney, reel: session.montantReelMobileMoney },
                  { icon: "🏦", label: "Virement",     attendu: session.ventesVirement,    reel: session.montantReelVirement },
                  { icon: "📝", label: "Chèque",       attendu: session.ventesCheque,      reel: session.montantReelCheque },
                ].map((m, i) => {
                  const diff = m.reel - m.attendu;
                  return (
                    <div key={i} className="bg-surface2 rounded-xl p-3 text-center">
                      <p className="text-lg mb-1">{m.icon}</p>
                      <p className="text-[10px] font-mono text-muted mb-2">{m.label}</p>
                      <p className="text-xs text-muted font-mono">Attendu: {fmt(m.attendu)} F</p>
                      <p className="font-mono font-bold text-sm mt-0.5">{fmt(m.reel)} F</p>
                      {diff !== 0 && (
                        <p className={clsx("text-xs font-mono mt-0.5", diff > 0 ? "text-warning" : "text-danger")}>
                          {diff > 0 ? "+" : ""}{fmt(diff)} F
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Écart global */}
              <div className={clsx("rounded-2xl p-4 flex items-center justify-between border-2",
                session.ecart === 0 ? "bg-success/10 border-success/40"
                : session.ecart > 0 ? "bg-warning/10 border-warning/40"
                : "bg-danger/10 border-danger/40"
              )}>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">
                    {session.ecart === 0 ? "✓ Caisse équilibrée"
                    : session.ecart > 0 ? "⚠ Excédent de caisse"
                    : "⚠ Déficit de caisse"}
                  </p>
                  <p className="text-sm text-muted2">
                    Réel ({fmt(session.montantReelTotal)} F) − Attendu ({fmt(session.montantAttendu)} F)
                  </p>
                </div>
                <p className={clsx("text-2xl font-extrabold font-mono",
                  session.ecart === 0 ? "text-success" : session.ecart > 0 ? "text-warning" : "text-danger"
                )}>
                  {session.ecart > 0 ? "+" : ""}{fmt(session.ecart)} F
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Détail ventes */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Ventes de la session</h2>
          <div className="flex items-center gap-2">
            <span className="badge-green">{ventes.length} vente{ventes.length > 1 ? "s" : ""}</span>
            <span className="badge-blue">{fmt(session.totalVentes)} F</span>
          </div>
        </div>
        {ventes.length === 0 ? (
          <div className="text-center py-10 text-muted font-mono text-sm">Aucune vente durant cette session</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th><th>Heure</th><th>Client</th>
                  <th>Employé</th><th>Mode</th><th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {ventes.map((v: any) => (
                  <tr key={v._id}>
                    <td className="font-mono text-xs text-accent">{v.reference}</td>
                    <td className="font-mono text-xs text-muted">
                      {new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{v.client}</td>
                    <td className="text-sm">{v.employeNom || v.employe?.nom || "—"}</td>
                    <td>{MODE_ICON[v.modePaiement]} <span className="text-xs text-muted capitalize">{v.modePaiement.replace("_", " ")}</span></td>
                    <td className="font-mono font-bold">{fmt(v.montantTotal)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mouvements d'argent */}
      {mouvements.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Mouvements d&apos;argent</h2>
            <span className="badge-blue">{mouvements.length} mouvement{mouvements.length > 1 ? "s" : ""}</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Référence</th><th>Heure</th><th>Type</th><th>Motif</th><th>Flux</th><th>Montant</th></tr>
              </thead>
              <tbody>
                {mouvements.map((m: any) => {
                  const tc = TYPE_CONFIG[m.type];
                  return (
                    <tr key={m._id}>
                      <td className="font-mono text-xs text-accent">{m.reference}</td>
                      <td className="font-mono text-xs text-muted">
                        {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>{tc?.icon} <span className="text-xs">{tc?.label}</span></td>
                      <td className="text-xs text-muted">{m.motif || "—"}</td>
                      <td>
                        <span className={tc?.flux === "entree" ? "badge-green" : "badge-red"}>
                          {tc?.flux === "entree" ? "▲ Entrée" : "▼ Sortie"}
                        </span>
                      </td>
                      <td className={clsx("font-mono font-bold",
                        tc?.flux === "entree" ? "text-success" : "text-danger"
                      )}>
                        {tc?.flux === "entree" ? "+" : "−"}{fmt(m.montant)} F
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note de fermeture */}
      {session.noteFermeture && (
        <div className="card p-4">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Note de fermeture</p>
          <p className="text-sm">{session.noteFermeture}</p>
        </div>
      )}
    </div>
  );
}
