// app/(print)/stock/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export default function PrintStockPage() {
  const searchParams = useSearchParams();
  const boutiqueId   = searchParams.get("boutique") || "";

  const [lignes,   setLignes]   = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [tenant,   setTenant]   = useState<any>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stock").then(r => r.json()),
      fetch("/api/boutiques").then(r => r.json()),
      fetch("/api/parametres").then(r => r.json()),
    ]).then(([s, b, p]) => {
      if (s.success) setLignes(s.data);
      if (b.success) setBoutiques(b.data);
      if (p.success) setTenant(p.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="print-page" style={{ textAlign:"center", paddingTop:80, color:"#64748b" }}>Chargement...</div>;

  // Colonnes boutiques filtrées
  const colsBoutiques = boutiqueId
    ? boutiques.filter(b => b._id === boutiqueId)
    : boutiques;

  const nbAlertes  = lignes.filter(l => l.alertes?.length > 0).length;
  const nbRuptures = lignes.filter(l => colsBoutiques.every(b => (l.stocks?.[b._id] ?? 0) === 0)).length;
  const valeurTotal = lignes.reduce((s: number, l: any) => {
    const qteTotal = colsBoutiques.reduce((sq: number, b: any) => sq + (l.stocks?.[b._id] ?? 0), 0);
    return s + qteTotal * (l.prixAchat ?? 0);
  }, 0);

  return (
    <>
      <div className="print-actions">
        <span style={{ color:"#e2e8f0", fontWeight:700 }}>🖨️ État des stocks</span>
        <span className="print-actions-spacer" />
        <button className="btn-close-print" onClick={() => window.close()}>✕ Fermer</button>
        <button className="btn-print" onClick={() => window.print()}>🖨️ Imprimer / PDF</button>
      </div>

      <div className="print-page">
        <div className="doc-header">
          <div>
            <div className="doc-logo">Gesto<span>Pro</span></div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
              {tenant?.nomEntreprise || "Mon Entreprise"}
            </div>
          </div>
          <div className="doc-meta">
            <strong>ÉTAT DES STOCKS</strong>
            {boutiqueId && colsBoutiques[0] && <>Boutique : {colsBoutiques[0].nom}<br/></>}
            Date : {new Date().toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" })}<br/>
            {lignes.length} produit{lignes.length > 1 ? "s" : ""}
          </div>
        </div>

        {/* KPIs résumés */}
        <div className="doc-grid doc-grid-3" style={{ marginBottom:28 }}>
          <div className="doc-kpi">
            <div className="doc-kpi-label">Produits en catalogue</div>
            <div className="doc-kpi-value">{lignes.length}</div>
          </div>
          <div className="doc-kpi" style={{ borderColor: nbAlertes > 0 ? "#fca5a5" : "#86efac" }}>
            <div className="doc-kpi-label">Alertes / Ruptures</div>
            <div className="doc-kpi-value" style={{ color: nbAlertes > 0 ? "#dc2626" : "#16a34a" }}>
              {nbAlertes}
            </div>
            <div className="doc-kpi-sub">dont {nbRuptures} rupture{nbRuptures > 1 ? "s" : ""}</div>
          </div>
          <div className="doc-kpi">
            <div className="doc-kpi-label">Valeur stock estimée</div>
            <div className="doc-kpi-value">{fmt(valeurTotal)} F</div>
          </div>
        </div>

        {/* Tableau */}
        <table className="doc-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              {colsBoutiques.map(b => (
                <th key={b._id} className="right">{b.nom}</th>
              ))}
              <th className="right">Total</th>
              <th className="right">Seuil</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l: any) => {
              const total = colsBoutiques.reduce((s: number, b: any) => s + (l.stocks?.[b._id] ?? 0), 0);
              const enAlerte  = total <= l.seuilAlerte && total > 0;
              const enRupture = total === 0;
              return (
                <tr key={l._id}>
                  <td className="mono" style={{ fontSize:11 }}>{l.reference}</td>
                  <td style={{ fontWeight:600 }}>{l.nom}</td>
                  <td style={{ fontSize:12, color:"#64748b" }}>{l.categorie || "—"}</td>
                  {colsBoutiques.map(b => (
                    <td key={b._id} className="mono right" style={{ fontSize:12 }}>
                      {l.stocks?.[b._id] ?? 0}
                    </td>
                  ))}
                  <td className="mono right" style={{ fontWeight:700, color: enRupture ? "#dc2626" : enAlerte ? "#d97706" : "#16a34a" }}>
                    {total}
                  </td>
                  <td className="mono right" style={{ fontSize:12, color:"#94a3b8" }}>{l.seuilAlerte}</td>
                  <td>
                    {enRupture
                      ? <span className="doc-badge doc-badge-red">Rupture</span>
                      : enAlerte
                      ? <span className="doc-badge doc-badge-orange">Faible</span>
                      : <span className="doc-badge doc-badge-green">OK</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="doc-footer">
          {tenant?.nomEntreprise || "GestoPro"} · État des stocks au {new Date().toLocaleDateString("fr-FR")}
        </div>
      </div>
    </>
  );
}
