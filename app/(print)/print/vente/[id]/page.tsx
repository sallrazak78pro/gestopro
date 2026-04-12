// app/(print)/vente/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtDate = (d: string) => new Date(d).toLocaleString("fr-FR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});
const MODE_PAIEMENT: Record<string, string> = {
  especes:   "Espèces",
  carte:     "Carte bancaire",
  mobile:    "Mobile Money",
  cheque:    "Chèque",
  virement:  "Virement",
  credit:    "Crédit",
};

// ── Composant ticket (réutilisé deux fois) ─────────────────────────────────────
function Ticket({ vente, tenant, copie }: { vente: any; tenant: any; copie: "client" | "caissier" }) {
  return (
    <div className="ticket">

      {/* ── EN-TÊTE ── */}
      <div className="ticket-center ticket-bold" style={{ fontSize: 15, letterSpacing: 0.5 }}>
        {tenant?.nom || "Mon Entreprise"}
      </div>
      {tenant?.ville && (
        <div className="ticket-center ticket-small">{tenant.ville}{tenant?.pays ? `, ${tenant.pays}` : ""}</div>
      )}
      {tenant?.telephone && (
        <div className="ticket-center ticket-small">Tél : {tenant.telephone}</div>
      )}

      <div className="ticket-sep" />

      {/* ── INFOS VENTE ── */}
      <div className="ticket-row">
        <span className="ticket-small">Réf :</span>
        <span className="ticket-small ticket-mono">{vente.reference}</span>
      </div>
      <div className="ticket-row">
        <span className="ticket-small">Date :</span>
        <span className="ticket-small ticket-mono">{fmtDate(vente.createdAt)}</span>
      </div>
      <div className="ticket-row">
        <span className="ticket-small">Caisse :</span>
        <span className="ticket-small">{vente.boutique?.nom}</span>
      </div>
      {vente.employeNom && (
        <div className="ticket-row">
          <span className="ticket-small">Caissier :</span>
          <span className="ticket-small">{vente.employeNom}</span>
        </div>
      )}
      {vente.client && vente.client !== "Client comptoir" && (
        <div className="ticket-row">
          <span className="ticket-small">Client :</span>
          <span className="ticket-small">{vente.client}</span>
        </div>
      )}

      <div className="ticket-sep" />

      {/* ── ARTICLES ── */}
      <div className="ticket-articles-header">
        <span>Désignation</span>
        <span>Total</span>
      </div>

      {vente.lignes?.map((l: any, i: number) => (
        <div key={i} className="ticket-article">
          <div className="ticket-article-nom">{l.nomProduit}</div>
          <div className="ticket-row ticket-small">
            <span className="ticket-mono">{l.quantite} × {fmt(l.prixUnitaire)} F</span>
            <span className="ticket-mono ticket-bold">{fmt(l.sousTotal)} F</span>
          </div>
        </div>
      ))}

      <div className="ticket-sep" />

      {/* ── TOTAUX ── */}
      {vente.remise > 0 && (
        <div className="ticket-row ticket-small">
          <span>Sous-total :</span>
          <span className="ticket-mono">{fmt(vente.montantTotal + vente.remise)} F</span>
        </div>
      )}
      {vente.remise > 0 && (
        <div className="ticket-row ticket-small" style={{ color: "#ef4444" }}>
          <span>Remise :</span>
          <span className="ticket-mono">- {fmt(vente.remise)} F</span>
        </div>
      )}

      <div className="ticket-total">
        <span>TOTAL</span>
        <span className="ticket-mono">{fmt(vente.montantTotal)} F</span>
      </div>

      <div className="ticket-row ticket-small" style={{ marginTop: 4 }}>
        <span>Règlement :</span>
        <span>{MODE_PAIEMENT[vente.modePaiement] ?? vente.modePaiement}</span>
      </div>

      {vente.montantRecu > vente.montantTotal && (
        <>
          <div className="ticket-row ticket-small">
            <span>Reçu :</span>
            <span className="ticket-mono">{fmt(vente.montantRecu)} F</span>
          </div>
          <div className="ticket-row ticket-small ticket-bold">
            <span>Monnaie :</span>
            <span className="ticket-mono">{fmt(vente.montantRecu - vente.montantTotal)} F</span>
          </div>
        </>
      )}

      {/* ── NOTE ── */}
      {vente.note && (
        <>
          <div className="ticket-sep" />
          <div className="ticket-small" style={{ fontStyle: "italic" }}>Note : {vente.note}</div>
        </>
      )}

      <div className="ticket-sep" />

      {/* ── PIED ── */}
      <div className="ticket-center ticket-small" style={{ marginBottom: 4 }}>
        Merci pour votre achat !
      </div>
      <div className="ticket-center ticket-small" style={{ opacity: 0.6 }}>
        GestoPro · Reçu #{vente.reference}
      </div>

      {/* ── ETIQUETTE COPIE ── */}
      <div className="ticket-copie">
        {copie === "client" ? "— Exemplaire CLIENT —" : "— Exemplaire CAISSIER —"}
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function PrintVentePage() {
  const { id }           = useParams();
  const [vente,   setVente]   = useState<any>(null);
  const [tenant,  setTenant]  = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/ventes/${id}`).then(r => r.json()),
      fetch("/api/parametres").then(r => r.json()),
    ]).then(([v, p]) => {
      if (v.success) setVente(v.data);
      if (p.success) setTenant(p.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40, fontFamily: "monospace", color: "#64748b" }}>
      Chargement du ticket…
    </div>
  );
  if (!vente) return (
    <div style={{ textAlign: "center", padding: 40, fontFamily: "monospace" }}>
      Vente introuvable.
    </div>
  );

  return (
    <>
      {/* ── BARRE D'ACTIONS (masquée à l'impression) ── */}
      <div className="print-actions">
        <span style={{ color: "#e2e8f0", fontWeight: 700 }}>
          🖨️ Ticket — {vente.reference}
        </span>
        <span className="print-actions-spacer" />
        <button className="btn-close-print" onClick={() => window.close()}>✕ Fermer</button>
        <button className="btn-print" onClick={() => window.print()}>
          🖨️ Imprimer (double ticket)
        </button>
      </div>

      {/* ── DOUBLE TICKET ── */}
      <div className="tickets-wrapper">
        <Ticket vente={vente} tenant={tenant} copie="client" />
        <Ticket vente={vente} tenant={tenant} copie="caissier" />
      </div>
    </>
  );
}
