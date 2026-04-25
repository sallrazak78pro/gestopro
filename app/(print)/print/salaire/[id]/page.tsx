// app/(print)/salaire/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function PrintSalairePage() {
  const { id }  = useParams();
  const [salaire, setSalaire] = useState<any>(null);
  const [tenant,  setTenant]  = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/salaires/${id}`).then(r => r.json()),
      fetch("/api/parametres").then(r => r.json()),
    ]).then(([s, p]) => {
      if (s.success) setSalaire(s.data);
      if (p.success) setTenant(p.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="print-page" style={{ textAlign:"center", paddingTop:80, color:"#64748b" }}>Chargement...</div>;
  if (!salaire) return <div className="print-page" style={{ textAlign:"center", paddingTop:80 }}>Fiche introuvable.</div>;

  const employe = salaire.employe;
  const periode = `${MOIS[(salaire.mois ?? 1) - 1]} ${salaire.annee}`;

  return (
    <>
      <div className="print-actions">
        <span style={{ color:"#e2e8f0", fontWeight:700 }}>🖨️ Bulletin de salaire — {employe?.nom} {employe?.prenom}</span>
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
            <strong>BULLETIN DE SALAIRE</strong>
            Période : {periode}<br/>
            Date d&apos;émission : {new Date(salaire.createdAt).toLocaleDateString("fr-FR")}<br/>
            <span className={`doc-badge ${salaire.statut === "paye" ? "doc-badge-green" : "doc-badge-orange"}`}>
              {salaire.statut === "paye" ? "Payé" : "En attente"}
            </span>
          </div>
        </div>

        {/* Infos employé */}
        <div className="doc-parties">
          <div className="doc-party">
            <div className="doc-party-label">Employeur</div>
            <div className="doc-party-name">{tenant?.nomEntreprise || "Mon Entreprise"}</div>
            <div className="doc-party-info">{tenant?.adresse}</div>
          </div>
          <div className="doc-party">
            <div className="doc-party-label">Employé</div>
            <div className="doc-party-name">{employe?.prenom} {employe?.nom}</div>
            <div className="doc-party-info">
              {employe?.poste && <>Poste : {employe.poste}<br/></>}
              {employe?.boutique?.nom && <>Boutique : {employe.boutique.nom}<br/></>}
              {employe?.dateEmbauche && <>Embauché le : {new Date(employe.dateEmbauche).toLocaleDateString("fr-FR")}</>}
            </div>
          </div>
        </div>

        {/* Calcul */}
        <h3 style={{ fontSize:13, fontWeight:800, marginBottom:12, color:"#1a1a2e", textTransform:"uppercase", letterSpacing:0.5 }}>
          Détail du calcul
        </h3>
        <table className="doc-table">
          <thead>
            <tr><th>Libellé</th><th className="right">Montant</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight:600 }}>Salaire de base — {periode}</td>
              <td className="mono right">{fmt(salaire.salaireBase)} F</td>
            </tr>
            {(salaire.avancesDeduitees ?? []).map((a: any, i: number) => (
              <tr key={i}>
                <td style={{ color:"#dc2626" }}>
                  Avance du {new Date(a.date).toLocaleDateString("fr-FR")}
                  {a.motif && ` — ${a.motif}`}
                </td>
                <td className="mono right" style={{ color:"#dc2626" }}>− {fmt(a.montant)} F</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="doc-totals">
          <div className="doc-totals-box">
            <div className="doc-total-row">
              <span>Salaire brut</span>
              <span className="mono">{fmt(salaire.salaireBase)} F</span>
            </div>
            {salaire.totalAvances > 0 && (
              <div className="doc-total-row">
                <span>Total avances déduites</span>
                <span className="mono" style={{ color:"#dc2626" }}>− {fmt(salaire.totalAvances)} F</span>
              </div>
            )}
            <div className="doc-total-row">
              <span>NET À PAYER</span>
              <span className="mono">{fmt(salaire.montantNet)} F</span>
            </div>
          </div>
        </div>

        {salaire.note && (
          <div className="doc-note"><strong>Note :</strong> {salaire.note}</div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginTop:40, marginBottom:20 }}>
          <div style={{ borderTop:"2px solid #1a1a2e", paddingTop:10 }}>
            <div style={{ fontSize:12, color:"#64748b" }}>Signature de l&apos;employeur</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{tenant?.nomEntreprise}</div>
          </div>
          <div style={{ borderTop:"2px solid #1a1a2e", paddingTop:10 }}>
            <div style={{ fontSize:12, color:"#64748b" }}>Signature de l&apos;employé</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{employe?.prenom} {employe?.nom}</div>
          </div>
        </div>

        <div className="doc-footer">
          {tenant?.nomEntreprise || "GestoPro"} · Document confidentiel · {periode}
        </div>
      </div>
    </>
  );
}
