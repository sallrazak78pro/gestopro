// app/(print)/commande/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const STATUT: Record<string, { label: string; cls: string }> = {
  brouillon:           { label: "Brouillon",          cls: "doc-badge-orange" },
  envoyee:             { label: "Envoyée",             cls: "doc-badge-blue" },
  recue_partiellement: { label: "Reçue partiellement", cls: "doc-badge-orange" },
  recue:               { label: "Reçue",               cls: "doc-badge-green" },
  annulee:             { label: "Annulée",             cls: "doc-badge-red" },
};

export default function PrintCommandePage() {
  const { id }  = useParams();
  const [commande, setCommande] = useState<any>(null);
  const [tenant,   setTenant]   = useState<any>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/commandes/${id}`).then(r => r.json()),
      fetch("/api/parametres").then(r => r.json()),
    ]).then(([c, p]) => {
      if (c.success) setCommande(c.data);
      if (p.success) setTenant(p.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="print-page" style={{ textAlign:"center", paddingTop:80, color:"#64748b" }}>Chargement...</div>;
  if (!commande) return <div className="print-page" style={{ textAlign:"center", paddingTop:80 }}>Commande introuvable.</div>;

  const sc = STATUT[commande.statut] ?? STATUT.brouillon;
  const pctRecu = (() => {
    const total = commande.lignes.reduce((s: number, l: any) => s + l.quantiteCommandee, 0);
    const recu  = commande.lignes.reduce((s: number, l: any) => s + l.quantiteRecue, 0);
    return total > 0 ? Math.round((recu / total) * 100) : 0;
  })();

  return (
    <>
      <div className="print-actions">
        <span style={{ color:"#e2e8f0", fontWeight:700 }}>🖨️ Bon de commande — {commande.reference}</span>
        <span className="print-actions-spacer" />
        <button className="btn-close-print" onClick={() => window.close()}>✕ Fermer</button>
        <button className="btn-print" onClick={() => window.print()}>🖨️ Imprimer / PDF</button>
      </div>

      <div className="print-page">
        <div className="doc-header">
          <div>
            <div className="doc-logo">Gesto<span>Pro</span></div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
              {tenant?.nomEntreprise || "Mon Entreprise"}<br/>
              {tenant?.adresse && <>{tenant.adresse}<br/></>}
              {tenant?.telephone && <>Tél : {tenant.telephone}</>}
            </div>
          </div>
          <div className="doc-meta">
            <strong>BON DE COMMANDE</strong>
            Réf : {commande.reference}<br/>
            Date : {new Date(commande.dateCommande).toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" })}<br/>
            {commande.dateLivraison && (
              <>Livraison prévue : {new Date(commande.dateLivraison).toLocaleDateString("fr-FR")}<br/></>
            )}
            <span className={`doc-badge ${sc.cls}`} style={{ marginTop:6 }}>{sc.label}</span>
            {pctRecu > 0 && <span style={{ marginLeft:6, fontSize:11, color:"#64748b" }}>{pctRecu}% reçu</span>}
          </div>
        </div>

        <div className="doc-parties">
          <div className="doc-party">
            <div className="doc-party-label">Acheteur</div>
            <div className="doc-party-name">{tenant?.nomEntreprise || "Mon Entreprise"}</div>
            <div className="doc-party-info">
              Destination : {commande.destination?.nom}<br/>
              {tenant?.adresse}
            </div>
          </div>
          <div className="doc-party">
            <div className="doc-party-label">Fournisseur</div>
            <div className="doc-party-name">{commande.fournisseur?.nom}</div>
            <div className="doc-party-info">
              {commande.fournisseur?.telephone && <>Tél : {commande.fournisseur.telephone}<br/></>}
              {commande.fournisseur?.email && <>Email : {commande.fournisseur.email}<br/></>}
              {commande.fournisseur?.adresse}
            </div>
          </div>
        </div>

        <table className="doc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Désignation</th>
              <th className="right">Qté commandée</th>
              <th className="right">Qté reçue</th>
              <th className="right">Prix unit.</th>
              <th className="right">Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {commande.lignes.map((l: any, i: number) => (
              <tr key={i}>
                <td className="mono">{i + 1}</td>
                <td style={{ fontWeight:600 }}>{l.nomProduit}</td>
                <td className="mono right">{l.quantiteCommandee}</td>
                <td className="mono right" style={{ color: l.quantiteRecue >= l.quantiteCommandee ? "#16a34a" : l.quantiteRecue > 0 ? "#d97706" : "#94a3b8" }}>
                  {l.quantiteRecue}
                </td>
                <td className="mono right">{fmt(l.prixUnitaire)} F</td>
                <td className="mono right">{fmt(l.sousTotal)} F</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="doc-totals">
          <div className="doc-totals-box">
            <div className="doc-total-row">
              <span>Total HT</span>
              <span className="mono">{fmt(commande.montantTotal)} F</span>
            </div>
            {commande.montantPaye > 0 && (
              <div className="doc-total-row">
                <span>Déjà réglé</span>
                <span className="mono" style={{ color:"#16a34a" }}>− {fmt(commande.montantPaye)} F</span>
              </div>
            )}
            <div className="doc-total-row">
              <span>{commande.montantDu > 0 ? "RESTE DÛ" : "SOLDÉ ✓"}</span>
              <span className="mono" style={{ color: commande.montantDu > 0 ? "#dc2626" : "#16a34a" }}>
                {commande.montantDu > 0 ? fmt(commande.montantDu) + " F" : "0 F"}
              </span>
            </div>
          </div>
        </div>

        {commande.note && (
          <div className="doc-note"><strong>Note :</strong> {commande.note}</div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginTop:40, marginBottom:20 }}>
          <div style={{ borderTop:"2px solid #1a1a2e", paddingTop:10 }}>
            <div style={{ fontSize:12, color:"#64748b" }}>Signature acheteur</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{tenant?.nomEntreprise}</div>
          </div>
          <div style={{ borderTop:"2px solid #1a1a2e", paddingTop:10 }}>
            <div style={{ fontSize:12, color:"#64748b" }}>Signature fournisseur</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{commande.fournisseur?.nom}</div>
          </div>
        </div>

        <div className="doc-footer">
          {tenant?.nomEntreprise || "GestoPro"} · Document généré le {new Date().toLocaleDateString("fr-FR")}
        </div>
      </div>
    </>
  );
}
