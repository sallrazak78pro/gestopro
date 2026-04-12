// app/(dashboard)/commandes/[id]/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReceptionModal from "@/components/fournisseurs/ReceptionModal";
import PaiementFournisseurModal from "@/components/fournisseurs/PaiementFournisseurModal";
import clsx from "clsx";
import PrintButton from "@/components/ui/PrintButton";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const STATUT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  brouillon:           { label: "Brouillon",          color: "text-warning",  icon: "📝" },
  envoyee:             { label: "Envoyée",             color: "text-accent",   icon: "📤" },
  recue_partiellement: { label: "Reçue partiellement", color: "text-warning",  icon: "📦" },
  recue:               { label: "Reçue",               color: "text-success",  icon: "✅" },
  annulee:             { label: "Annulée",             color: "text-danger",   icon: "✕" },
};

export default function CommandeDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [commande, setCommande]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [showReception, setShowReception]   = useState(false);
  const [showPaiement, setShowPaiement]     = useState(false);
  const [boutiques, setBoutiques] = useState<any[]>([]);

  const fetchCommande = useCallback(async () => {
    const res = await fetch(`/api/commandes/${id}`);
    const json = await res.json();
    if (json.success) setCommande(json.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchCommande(); }, [fetchCommande]);
  useEffect(() => {
    fetch("/api/boutiques?type=boutique").then(r=>r.json()).then(j=>j.success&&setBoutiques(j.data));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted font-mono text-sm gap-3">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg> Chargement...
    </div>
  );
  if (!commande) return <div className="text-center py-20 text-muted font-mono">Commande introuvable</div>;

  const sc = STATUT_CONFIG[commande.statut];
  const pctPaye = commande.montantTotal > 0 ? Math.round((commande.montantPaye / commande.montantTotal) * 100) : 0;
  const pctRecu = (() => {
    const total = commande.lignes.reduce((s: number, l: any) => s + l.quantiteCommandee, 0);
    const recu  = commande.lignes.reduce((s: number, l: any) => s + l.quantiteRecue, 0);
    return total > 0 ? Math.round((recu / total) * 100) : 0;
  })();

  const canReceive = ["envoyee","recue_partiellement"].includes(commande.statut);
  const canPay     = commande.montantDu > 0 && commande.statut !== "annulee";

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost btn-sm">← Retour</button>
        <div className="ml-auto flex gap-2">
          <PrintButton href={`/print/commande/${id}`} label="🖨️ Bon de commande" />
          {canReceive && (
            <button onClick={() => setShowReception(true)} className="btn-primary btn-sm">
              📦 Réceptionner
            </button>
          )}
          {canPay && (
            <button onClick={() => setShowPaiement(true)} className="btn-success btn-sm">
              💳 Payer fournisseur
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-accent">{commande.reference}</span>
              <span className={clsx("text-sm font-bold", sc.color)}>{sc.icon} {sc.label}</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">{commande.fournisseur?.nom}</h1>
            <p className="text-sm text-muted2 mt-0.5">
              Destination : <span className="font-semibold text-white">{commande.destination?.nom}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold font-mono">{fmt(commande.montantTotal)} F</p>
            <p className="text-xs font-mono text-muted">
              {new Date(commande.dateCommande).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        {/* Barres de progression */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-muted">Réception marchandise</span>
              <span className={pctRecu === 100 ? "text-success" : "text-warning"}>{pctRecu}%</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pctRecu}%`, background: pctRecu===100 ? "#10b981" : "#f59e0b" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-muted">Paiement fournisseur</span>
              <span className={pctPaye === 100 ? "text-success" : "text-danger"}>{pctPaye}%</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pctPaye}%`, background: pctPaye===100 ? "#10b981" : "#ef4444" }} />
            </div>
          </div>
        </div>

        {/* Montants */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-surface2 rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Total commande</p>
            <p className="font-mono font-bold">{fmt(commande.montantTotal)} F</p>
          </div>
          <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Déjà payé</p>
            <p className="font-mono font-bold text-success">{fmt(commande.montantPaye)} F</p>
          </div>
          <div className={clsx("rounded-xl px-4 py-3 text-center border",
            commande.montantDu > 0 ? "bg-danger/10 border-danger/20" : "bg-surface2 border-border")}>
            <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">Reste dû</p>
            <p className={clsx("font-mono font-bold", commande.montantDu > 0 ? "text-danger" : "text-muted")}>
              {commande.montantDu > 0 ? fmt(commande.montantDu)+" F" : "✓ Soldé"}
            </p>
          </div>
        </div>
      </div>

      {/* Lignes de commande */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Articles commandés</h2>
          <span className="badge-blue">{commande.lignes.length} article{commande.lignes.length>1?"s":""}</span>
        </div>
        <table className="table">
          <thead>
            <tr><th>Produit</th><th>Commandé</th><th>Reçu</th><th>Restant</th><th>Prix unitaire</th><th>Sous-total</th><th>État</th></tr>
          </thead>
          <tbody>
            {commande.lignes.map((l: any, i: number) => {
              const restant = l.quantiteCommandee - l.quantiteRecue;
              return (
                <tr key={i}>
                  <td className="font-semibold text-sm">{l.nomProduit}</td>
                  <td className="font-mono text-sm">{l.quantiteCommandee}</td>
                  <td className={clsx("font-mono font-bold text-sm", l.quantiteRecue>0?"text-success":"text-muted")}>{l.quantiteRecue}</td>
                  <td className={clsx("font-mono text-sm", restant>0?"text-warning":"text-success")}>{restant>0?restant:"✓"}</td>
                  <td className="font-mono text-sm">{fmt(l.prixUnitaire)} F</td>
                  <td className="font-mono font-bold text-sm">{fmt(l.sousTotal)} F</td>
                  <td>
                    {l.quantiteRecue===0 ? <span className="badge-orange">En attente</span>
                    : l.quantiteRecue >= l.quantiteCommandee ? <span className="badge-green">✓ Complet</span>
                    : <span className="badge-orange">Partiel</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Total */}
        <div className="px-5 py-4 border-t border-border flex justify-end">
          <div className="flex items-center gap-4">
            <span className="font-bold">Total</span>
            <span className="font-mono font-extrabold text-xl text-accent">{fmt(commande.montantTotal)} F</span>
          </div>
        </div>
      </div>

      {commande.note && (
        <div className="card p-4">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Note</p>
          <p className="text-sm">{commande.note}</p>
        </div>
      )}

      {showReception && (
        <ReceptionModal
          commande={commande}
          onClose={() => setShowReception(false)}
          onSaved={() => { setShowReception(false); fetchCommande(); }}
        />
      )}
      {showPaiement && (
        <PaiementFournisseurModal
          commande={commande}
          boutiques={boutiques}
          onClose={() => setShowPaiement(false)}
          onSaved={() => { setShowPaiement(false); fetchCommande(); }}
        />
      )}
    </div>
  );
}
