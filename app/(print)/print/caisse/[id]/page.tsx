// app/(print)/caisse/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export default function PrintCaissePage() {
  const { id }    = useParams();
  const [session, setSession] = useState<any>(null);
  const [tenant,  setTenant]  = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/sessions-caisse/${id}`).then(r => r.json()),
      fetch("/api/parametres").then(r => r.json()),
    ]).then(([s, p]) => {
      if (s.success) setSession(s.data);
      if (p.success) setTenant(p.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="print-page" style={{ textAlign:"center", paddingTop:80, color:"#64748b" }}>Chargement...</div>;
  if (!session) return <div className="print-page" style={{ textAlign:"center", paddingTop:80 }}>Session introuvable.</div>;

  const ecart       = (session.montantComptage ?? 0) - (session.montantTheorique ?? 0);
  const estFerme    = session.statut === "fermee";
  const totalVentes = session.totalVentes ?? 0;
  const nbVentes    = session.nbVentes ?? 0;

  return (
    <>
      <div className="print-actions">
        <span style={{ color:"#e2e8f0", fontWeight:700 }}>🖨️ Rapport de caisse — {session.boutique?.nom}</span>
        <span className="print-actions-spacer" />
        <button className="btn-close-print" onClick={() => window.close()}>✕ Fermer</button>
        <button className="btn-print" onClick={() => window.print()}>🖨️ Imprimer / PDF</button>
      </div>

      <div className="print-page">
        {/* En-tête */}
        <div className="doc-header">
          <div>
            <div className="doc-logo">Gesto<span>Pro</span></div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
              {tenant?.nomEntreprise || "Mon Entreprise"}<br/>
              {tenant?.telephone && <>Tél : {tenant.telephone}</>}
            </div>
          </div>
          <div className="doc-meta">
            <strong>RAPPORT DE CAISSE</strong>
            Boutique : {session.boutique?.nom}<br/>
            Date : {new Date(session.dateOuverture).toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" })}<br/>
            Statut : <span className={`doc-badge ${estFerme ? "doc-badge-green" : "doc-badge-orange"}`}>
              {estFerme ? "Clôturée" : "Ouverte"}
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="doc-grid doc-grid-4" style={{ marginBottom:28 }}>
          <div className="doc-kpi">
            <div className="doc-kpi-label">Fond d&apos;ouverture</div>
            <div className="doc-kpi-value">{fmt(session.fondOuverture ?? 0)} F</div>
          </div>
          <div className="doc-kpi">
            <div className="doc-kpi-label">CA du jour</div>
            <div className="doc-kpi-value">{fmt(totalVentes)} F</div>
            <div className="doc-kpi-sub">{nbVentes} vente{nbVentes > 1 ? "s" : ""}</div>
          </div>
          <div className="doc-kpi">
            <div className="doc-kpi-label">Montant théorique</div>
            <div className="doc-kpi-value">{fmt(session.montantTheorique ?? 0)} F</div>
          </div>
          {estFerme && (
            <div className="doc-kpi" style={{ borderColor: ecart !== 0 ? "#fca5a5" : "#86efac" }}>
              <div className="doc-kpi-label">Écart de caisse</div>
              <div className="doc-kpi-value" style={{ color: ecart > 0 ? "#16a34a" : ecart < 0 ? "#dc2626" : "#1a1a2e" }}>
                {ecart > 0 ? "+" : ""}{fmt(ecart)} F
              </div>
              <div className="doc-kpi-sub">{ecart === 0 ? "✓ Équilibré" : ecart > 0 ? "Surplus" : "Manque"}</div>
            </div>
          )}
        </div>

        {/* Ventes du jour */}
        {session.ventes && session.ventes.length > 0 && (
          <>
            <h3 style={{ fontSize:13, fontWeight:800, marginBottom:12, color:"#1a1a2e", textTransform:"uppercase", letterSpacing:0.5 }}>
              Ventes de la session
            </h3>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Réf</th>
                  <th>Client</th>
                  <th>Employé</th>
                  <th>Heure</th>
                  <th className="right">Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {session.ventes.map((v: any) => (
                  <tr key={v._id}>
                    <td className="mono" style={{ fontSize:11 }}>{v.reference}</td>
                    <td style={{ fontSize:12 }}>{v.client || "Comptoir"}</td>
                    <td style={{ fontSize:12 }}>{v.employe ? `${v.employe.prenom ?? ""} ${v.employe.nom ?? ""}`.trim() : "—"}</td>
                    <td className="mono" style={{ fontSize:11 }}>
                      {new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })}
                    </td>
                    <td className="mono right">{fmt(v.montantTotal)} F</td>
                    <td>
                      <span className={`doc-badge ${v.statut === "payee" ? "doc-badge-green" : v.statut === "annulee" ? "doc-badge-red" : "doc-badge-orange"}`}>
                        {v.statut === "payee" ? "Payée" : v.statut === "annulee" ? "Annulée" : "En attente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Totaux */}
        <div className="doc-totals" style={{ marginTop:20 }}>
          <div className="doc-totals-box">
            <div className="doc-total-row">
              <span>Fond d&apos;ouverture</span>
              <span className="mono">{fmt(session.fondOuverture ?? 0)} F</span>
            </div>
            <div className="doc-total-row">
              <span>Total ventes</span>
              <span className="mono">{fmt(totalVentes)} F</span>
            </div>
            <div className="doc-total-row">
              <span>Montant théorique</span>
              <span className="mono">{fmt(session.montantTheorique ?? 0)} F</span>
            </div>
            {estFerme && (
              <>
                <div className="doc-total-row">
                  <span>Montant compté</span>
                  <span className="mono">{fmt(session.montantComptage ?? 0)} F</span>
                </div>
                <div className="doc-total-row">
                  <span style={{ color: ecart < 0 ? "#dc2626" : "#16a34a" }}>
                    Écart {ecart < 0 ? "(manque)" : ecart > 0 ? "(surplus)" : "(équilibré)"}
                  </span>
                  <span className="mono" style={{ color: ecart < 0 ? "#dc2626" : "#16a34a" }}>
                    {ecart > 0 ? "+" : ""}{fmt(ecart)} F
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {session.notesFermeture && (
          <div className="doc-note"><strong>Observations :</strong> {session.notesFermeture}</div>
        )}

        <div className="doc-footer">
          {tenant?.nomEntreprise || "GestoPro"} · Rapport généré le {new Date().toLocaleString("fr-FR")}
          {estFerme && session.userFermeture && ` · Fermé par ${session.userFermeture}`}
        </div>
      </div>
    </>
  );
}
