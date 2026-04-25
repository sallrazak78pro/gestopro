// app/(dashboard)/ventes/[id]/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PrintButton from "@/components/ui/PrintButton";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const STATUT_BADGE: Record<string, string> = {
  payee: "badge-green", en_attente: "badge-orange", annulee: "badge-red",
};
const STATUT_LABEL: Record<string, string> = {
  payee: "Payée", en_attente: "En attente", annulee: "Annulée",
};

export default function VenteDetailPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "";
  const peutAnnuler = ["admin", "superadmin", "gestionnaire", "caissier"].includes(role);
  const peutValider = ["admin", "superadmin", "gestionnaire", "caissier"].includes(role);
  const { id } = useParams();
  const router = useRouter();
  const [vente, setVente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/ventes/${id}`)
      .then(r => r.json())
      .then(j => j.success && setVente(j.data))
      .finally(() => setLoading(false));
  }, [id]);

  async function changeStatut(statut: string) {
    setUpdating(true);
    const res = await fetch(`/api/ventes/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    const json = await res.json();
    if (json.success) setVente(json.data);
    setUpdating(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted font-mono text-sm gap-3">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Chargement...
    </div>
  );
  if (!vente) return <div className="text-center py-20 text-muted font-mono">Vente introuvable</div>;

  return (
    <div className="max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="btn-ghost btn-sm">← Retour</button>
        <div className="ml-auto">
          <PrintButton href={`/print/vente/${id}`} label="🖨️ Reçu PDF" />
        </div>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="badge-blue font-mono">{vente.reference}</span>
              <span className={STATUT_BADGE[vente.statut]}>{STATUT_LABEL[vente.statut]}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {fmt(vente.montantTotal)} F
            </h1>
            <p className="text-sm text-muted mt-1">
              {new Date(vente.createdAt).toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {vente.statut === "en_attente" && peutValider && (
              <button onClick={() => changeStatut("payee")} disabled={updating}
                className="btn-success btn-sm disabled:opacity-60">
                ✓ Encaisser
              </button>
            )}
            {vente.statut !== "annulee" && peutAnnuler && (
              <button onClick={() => {
                if (!confirm("Annuler cette vente ? Le stock sera restitué.")) return;
                changeStatut("annulee");
              }} disabled={updating}
                className="btn-danger btn-sm disabled:opacity-60">
                ✕ Annuler la vente
              </button>
            )}
          </div>
        </div>

        {/* Infos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Client", value: vente.client },
            { label: "Boutique", value: vente.boutique?.nom },
            { label: "Mode paiement", value: vente.modePaiement.replace("_", " ") },
            { label: "Caissier", value: vente.createdBy?.nom || "—" },
          ].map((info, i) => (
            <div key={i} className="bg-surface2 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">{info.label}</p>
              <p className="text-sm font-semibold capitalize">{info.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lignes de vente */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Articles vendus</h2>
          <span className="badge-blue">{vente.lignes.length} article{vente.lignes.length > 1 ? "s" : ""}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Prix unitaire</th>
              <th>Quantité</th>
              <th>Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {vente.lignes.map((l: any, i: number) => (
              <tr key={i}>
                <td className="font-semibold">{l.nomProduit}</td>
                <td className="font-mono text-sm">{fmt(l.prixUnitaire)} F</td>
                <td className="font-mono font-bold text-accent">{l.quantite}</td>
                <td className="font-mono font-bold">{fmt(l.sousTotal)} F</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div className="px-5 py-4 border-t border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Total</span>
            <span className="font-mono font-bold">{fmt(vente.montantTotal)} F</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Montant reçu</span>
            <span className="font-mono font-bold text-success">{fmt(vente.montantRecu)} F</span>
          </div>
          {vente.monnaie > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Monnaie rendue</span>
              <span className="font-mono font-bold text-warning">{fmt(vente.monnaie)} F</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-bold">Net à payer</span>
            <span className="font-mono font-extrabold text-lg text-accent">{fmt(vente.montantTotal)} F</span>
          </div>
        </div>
      </div>

      {vente.note && (
        <div className="card p-4">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">Note</p>
          <p className="text-sm">{vente.note}</p>
        </div>
      )}
    </div>
  );
}
