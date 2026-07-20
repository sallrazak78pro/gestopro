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

// ── Version texte du ticket (pour le partage vers une appli d'impression) ──────
function buildTicketText(vente: any, tenant: any, copie: "client" | "caissier") {
  const lignes: string[] = [];
  const sep = "--------------------------------";

  lignes.push(tenant?.nom || "Mon Entreprise");
  if (tenant?.ville) lignes.push(`${tenant.ville}${tenant?.pays ? `, ${tenant.pays}` : ""}`);
  if (tenant?.telephone) lignes.push(`Tél : ${tenant.telephone}`);
  lignes.push(sep);

  lignes.push(`Réf      : ${vente.reference}`);
  lignes.push(`Date     : ${fmtDate(vente.createdAt)}`);
  lignes.push(`Caisse   : ${vente.boutique?.nom ?? ""}`);
  if (vente.employeNom) lignes.push(`Caissier : ${vente.employeNom}`);
  if (vente.client && vente.client !== "Client comptoir") lignes.push(`Client   : ${vente.client}`);
  lignes.push(sep);

  vente.lignes?.forEach((l: any) => {
    lignes.push(l.nomProduit);
    lignes.push(`  ${l.quantite} x ${fmt(l.prixUnitaire)} F`.padEnd(24) + `${fmt(l.sousTotal)} F`);
  });
  lignes.push(sep);

  if (vente.remise > 0) {
    lignes.push(`Sous-total : ${fmt(vente.montantTotal + vente.remise)} F`);
    lignes.push(`Remise     : -${fmt(vente.remise)} F`);
  }
  lignes.push(`TOTAL : ${fmt(vente.montantTotal)} F`);
  lignes.push(`Règlement : ${MODE_PAIEMENT[vente.modePaiement] ?? vente.modePaiement}`);
  if (vente.montantRecu > vente.montantTotal) {
    lignes.push(`Reçu    : ${fmt(vente.montantRecu)} F`);
    lignes.push(`Monnaie : ${fmt(vente.montantRecu - vente.montantTotal)} F`);
  }

  if (vente.note) { lignes.push(sep); lignes.push(`Note : ${vente.note}`); }

  lignes.push(sep);
  lignes.push("Merci pour votre achat !");
  lignes.push(`GestoPro · Reçu #${vente.reference}`);
  lignes.push(copie === "client" ? "— Exemplaire CLIENT —" : "— Exemplaire CAISSIER —");

  return lignes.join("\n");
}

// ── Version image du ticket (pour les applis d'étiquette/impression qui
// n'acceptent que des images, ex. MLabel) ────────────────────────────────
// Largeur calée sur un papier ~3 à 4cm (203 ppp, résolution thermique
// standard) — à ajuster si l'appli cible attend une largeur précise.
const TICKET_IMG_WIDTH = 280;

type TicketDrawLine =
  | { kind: "center" | "left"; text: string; bold?: boolean; italic?: boolean; size: number }
  | { kind: "row"; left: string; right: string; bold?: boolean; size: number }
  | { kind: "sep" };

function buildTicketDrawLines(vente: any, tenant: any, copie: "client" | "caissier"): TicketDrawLine[] {
  const lines: TicketDrawLine[] = [];
  lines.push({ kind: "center", text: tenant?.nom || "Mon Entreprise", bold: true, size: 15 });
  if (tenant?.ville) lines.push({ kind: "center", text: `${tenant.ville}${tenant?.pays ? `, ${tenant.pays}` : ""}`, size: 10 });
  if (tenant?.telephone) lines.push({ kind: "center", text: `Tél : ${tenant.telephone}`, size: 10 });
  lines.push({ kind: "sep" });

  lines.push({ kind: "row", left: "Réf :", right: vente.reference, size: 10 });
  lines.push({ kind: "row", left: "Date :", right: fmtDate(vente.createdAt), size: 10 });
  lines.push({ kind: "row", left: "Caisse :", right: vente.boutique?.nom ?? "", size: 10 });
  if (vente.employeNom) lines.push({ kind: "row", left: "Caissier :", right: vente.employeNom, size: 10 });
  if (vente.client && vente.client !== "Client comptoir") lines.push({ kind: "row", left: "Client :", right: vente.client, size: 10 });
  lines.push({ kind: "sep" });

  lines.push({ kind: "row", left: "Désignation", right: "Total", bold: true, size: 9 });
  vente.lignes?.forEach((l: any) => {
    lines.push({ kind: "left", text: l.nomProduit, bold: true, size: 11 });
    lines.push({ kind: "row", left: `${l.quantite} x ${fmt(l.prixUnitaire)} F`, right: `${fmt(l.sousTotal)} F`, size: 10 });
  });
  lines.push({ kind: "sep" });

  if (vente.remise > 0) {
    lines.push({ kind: "row", left: "Sous-total :", right: `${fmt(vente.montantTotal + vente.remise)} F`, size: 10 });
    lines.push({ kind: "row", left: "Remise :", right: `-${fmt(vente.remise)} F`, size: 10 });
  }
  lines.push({ kind: "row", left: "TOTAL", right: `${fmt(vente.montantTotal)} F`, bold: true, size: 14 });
  lines.push({ kind: "row", left: "Règlement :", right: MODE_PAIEMENT[vente.modePaiement] ?? vente.modePaiement, size: 10 });
  if (vente.montantRecu > vente.montantTotal) {
    lines.push({ kind: "row", left: "Reçu :", right: `${fmt(vente.montantRecu)} F`, size: 10 });
    lines.push({ kind: "row", left: "Monnaie :", right: `${fmt(vente.montantRecu - vente.montantTotal)} F`, bold: true, size: 10 });
  }

  if (vente.note) {
    lines.push({ kind: "sep" });
    lines.push({ kind: "left", text: `Note : ${vente.note}`, italic: true, size: 10 });
  }

  lines.push({ kind: "sep" });
  lines.push({ kind: "center", text: "Merci pour votre achat !", size: 10 });
  lines.push({ kind: "center", text: `GestoPro · Reçu #${vente.reference}`, size: 10 });
  lines.push({ kind: "center", text: copie === "client" ? "— Exemplaire CLIENT —" : "— Exemplaire CAISSIER —", bold: true, size: 10 });

  return lines;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const wrapped: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      wrapped.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) wrapped.push(current);
  return wrapped.length > 0 ? wrapped : [""];
}

const CANVAS_FONT = (size: number, bold?: boolean, italic?: boolean) =>
  `${italic ? "italic " : ""}${bold ? "bold " : ""}${size}px "Courier New", monospace`;

// Rend un ticket en image PNG (deux passes : mesure de la hauteur, puis dessin).
async function buildTicketImageBlob(vente: any, tenant: any, copie: "client" | "caissier"): Promise<Blob> {
  const width    = TICKET_IMG_WIDTH;
  const paddingX = 14;
  const contentW = width - paddingX * 2;
  const lineGap  = 6;

  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d")!;
  const drawLines = buildTicketDrawLines(vente, tenant, copie);

  // ── Passe 1 : mesurer ──────────────────────────────────────────────────
  type Resolved = { y: number } & (
    | { kind: "text"; text: string; align: "center" | "left"; bold?: boolean; italic?: boolean; size: number }
    | { kind: "row"; left: string; right: string; bold?: boolean; size: number }
    | { kind: "sep" }
  );
  const resolved: Resolved[] = [];
  let y = 16;

  for (const line of drawLines) {
    if (line.kind === "sep") {
      y += 10;
      resolved.push({ kind: "sep", y });
      y += 10;
      continue;
    }
    if (line.kind === "row") {
      ctx.font = CANVAS_FONT(line.size, line.bold);
      y += line.size + lineGap;
      resolved.push({ kind: "row", left: line.left, right: line.right, bold: line.bold, size: line.size, y });
      continue;
    }
    // center | left — peut passer sur plusieurs lignes
    ctx.font = CANVAS_FONT(line.size, line.bold, line.italic);
    const sub = wrapCanvasText(ctx, line.text, contentW);
    sub.forEach(s => {
      y += line.size + lineGap;
      resolved.push({ kind: "text", text: s, align: line.kind, bold: line.bold, italic: line.italic, size: line.size, y });
    });
  }
  y += 16; // marge basse

  // ── Passe 2 : dessiner ─────────────────────────────────────────────────
  canvas.width  = width;
  canvas.height = Math.ceil(y);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";

  for (const r of resolved) {
    if (r.kind === "sep") {
      ctx.save();
      ctx.strokeStyle = "#555";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(paddingX, r.y);
      ctx.lineTo(width - paddingX, r.y);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    if (r.kind === "row") {
      ctx.font = CANVAS_FONT(r.size, r.bold);
      ctx.textAlign = "left";
      ctx.fillText(r.left, paddingX, r.y);
      ctx.textAlign = "right";
      ctx.fillText(r.right, width - paddingX, r.y);
      continue;
    }
    ctx.font = CANVAS_FONT(r.size, r.bold, r.italic);
    ctx.textAlign = r.align === "center" ? "center" : "left";
    ctx.fillText(r.text, r.align === "center" ? width / 2 : paddingX, r.y);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("Échec de génération de l'image")), "image/png");
  });
}

// ── Composant ticket (réutilisé deux fois) ─────────────────────────────────────
function Ticket({ vente, tenant, copie }: { vente: any; tenant: any; copie: "client" | "caissier" }) {
  return (
    <div className="ticket">

      {/* ── EN-TÊTE ── */}
      <div className="ticket-center ticket-bold" style={{ fontSize: 18, letterSpacing: 0.5 }}>
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
  const [canShare, setCanShare] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/ventes/${id}`).then(r => r.json()),
      fetch("/api/parametres").then(r => r.json()),
    ]).then(([v, p]) => {
      if (v.success) setVente(v.data);
      if (p.success) setTenant(p.data);
    }).finally(() => setLoading(false));
  }, [id]);

  // navigator.share n'existe que côté client (et surtout sur mobile/tablette) —
  // on n'affiche les boutons que quand l'appareil peut réellement les utiliser.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // Cas 1 : partage en texte brut — pour les applis qui impriment du texte
  // reçu par le partage système (ex. RawBT et la plupart des ponts d'impression).
  async function handleShareTexte() {
    if (!vente) return;
    setShareError("");
    const texte = [
      buildTicketText(vente, tenant, "client"),
      buildTicketText(vente, tenant, "caissier"),
    ].join("\n\n========================================\n\n");
    try {
      await navigator.share({ title: `Ticket ${vente.reference}`, text: texte });
    } catch (err: any) {
      if (err?.name !== "AbortError") setShareError("Partage texte impossible sur cet appareil.");
    }
  }

  // Cas 2 : partage en image — pour les applis d'étiquette (ex. MLabel) qui
  // n'acceptent qu'une image à imprimer, pas du texte.
  async function handleShareImage() {
    if (!vente) return;
    setShareError("");
    setSharingImage(true);
    try {
      const [blobClient, blobCaissier] = await Promise.all([
        buildTicketImageBlob(vente, tenant, "client"),
        buildTicketImageBlob(vente, tenant, "caissier"),
      ]);
      const files = [
        new File([blobClient],   `ticket-${vente.reference}-client.png`,   { type: "image/png" }),
        new File([blobCaissier], `ticket-${vente.reference}-caissier.png`, { type: "image/png" }),
      ];
      if (navigator.canShare && !navigator.canShare({ files })) {
        setShareError("Le partage d'images n'est pas supporté sur cet appareil.");
        return;
      }
      await navigator.share({ title: `Ticket ${vente.reference}`, files });
    } catch (err: any) {
      if (err?.name !== "AbortError") setShareError("Partage image impossible sur cet appareil.");
    } finally {
      setSharingImage(false);
    }
  }

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
        {shareError && (
          <span style={{ color: "#ef4444", fontSize: 12 }}>{shareError}</span>
        )}
        <button className="btn-close-print" onClick={() => window.close()}>✕ Fermer</button>
        {canShare && (
          <>
            <button className="btn-share" onClick={handleShareTexte} title="Partager le texte du ticket (RawBT et applis similaires)">
              📤 Texte
            </button>
            <button className="btn-share" onClick={handleShareImage} disabled={sharingImage}
              title="Partager une image du ticket (MLabel et applis d'étiquette)">
              {sharingImage ? "⏳ …" : "🖼️ Image"}
            </button>
          </>
        )}
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
