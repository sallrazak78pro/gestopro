// app/(print)/vente/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

// Le vendeur (employe) n'est affiché que s'il diffère du caissier (createdBy) —
// sinon on afficherait deux fois la même personne. "employe" pointe vers une
// fiche Employe (pas forcément liée à un compte), donc on compare via son
// éventuel userId — pas son _id, qui n'est jamais dans le même espace que
// createdBy._id (toujours un User).
function getNoms(vente: any) {
  const caissier = vente.createdBy?.nom ?? "";
  const memePersonne = !!vente.employe?.userId && !!vente.createdBy?._id
    && String(vente.employe.userId) === String(vente.createdBy._id);
  const vendeurDifferent = !!vente.employeNom && !memePersonne;
  return { caissier, vendeur: vendeurDifferent ? vente.employeNom : null };
}

// ── Version texte du ticket (pour le partage vers une appli d'impression) ──────
function buildTicketText(vente: any) {
  const lignes: string[] = [];
  const sep = "--------------------------------";
  const { caissier, vendeur } = getNoms(vente);

  lignes.push(vente.boutique?.nom || "Boutique");
  lignes.push(sep);

  if (caissier) lignes.push(`Caissier : ${caissier}`);
  if (vendeur)  lignes.push(`Vendeur  : ${vendeur}`);
  lignes.push(sep);

  vente.lignes?.forEach((l: any) => {
    lignes.push(l.nomProduit);
    lignes.push(`  ${l.quantite} x ${fmt(l.prixUnitaire)} F`.padEnd(24) + `${fmt(l.sousTotal)} F`);
  });
  lignes.push(sep);

  lignes.push(`TOTAL : ${fmt(vente.montantTotal)} F`);

  return lignes.join("\n");
}

// ── Version image du ticket (pour les applis d'étiquette/impression qui
// n'acceptent que des images, ex. MLabel) ────────────────────────────────
// Largeur calée sur un papier ~3 à 4cm (203 ppp, résolution thermique
// standard) — à ajuster si l'appli cible attend une largeur précise.
const TICKET_IMG_WIDTH = 280;

type TicketDrawLine =
  | { kind: "center" | "left"; text: string; bold?: boolean; size: number }
  | { kind: "row"; left: string; right: string; bold?: boolean; size: number }
  | { kind: "sep" };

function buildTicketDrawLines(vente: any): TicketDrawLine[] {
  const lines: TicketDrawLine[] = [];
  const { caissier, vendeur } = getNoms(vente);

  lines.push({ kind: "center", text: vente.boutique?.nom || "Boutique", bold: true, size: 16 });
  lines.push({ kind: "sep" });

  if (caissier) lines.push({ kind: "row", left: "Caissier :", right: caissier, size: 10 });
  if (vendeur)  lines.push({ kind: "row", left: "Vendeur :",  right: vendeur,  size: 10 });
  lines.push({ kind: "sep" });

  lines.push({ kind: "row", left: "Désignation", right: "Total", bold: true, size: 9 });
  vente.lignes?.forEach((l: any) => {
    lines.push({ kind: "left", text: l.nomProduit, bold: true, size: 11 });
    lines.push({ kind: "row", left: `${l.quantite} x ${fmt(l.prixUnitaire)} F`, right: `${fmt(l.sousTotal)} F`, size: 10 });
  });
  lines.push({ kind: "sep" });

  lines.push({ kind: "row", left: "TOTAL", right: `${fmt(vente.montantTotal)} F`, bold: true, size: 15 });

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

const CANVAS_FONT = (size: number, bold?: boolean) =>
  `${bold ? "bold " : ""}${size}px "Courier New", monospace`;

// Rend le ticket en image PNG (deux passes : mesure de la hauteur, puis dessin).
async function buildTicketImageBlob(vente: any): Promise<Blob> {
  const width    = TICKET_IMG_WIDTH;
  const paddingX = 14;
  const contentW = width - paddingX * 2;
  const lineGap  = 6;

  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d")!;
  const drawLines = buildTicketDrawLines(vente);

  // ── Passe 1 : mesurer ──────────────────────────────────────────────────
  type Resolved = { y: number } & (
    | { kind: "text"; text: string; align: "center" | "left"; bold?: boolean; size: number }
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
    ctx.font = CANVAS_FONT(line.size, line.bold);
    const sub = wrapCanvasText(ctx, line.text, contentW);
    sub.forEach(s => {
      y += line.size + lineGap;
      resolved.push({ kind: "text", text: s, align: line.kind, bold: line.bold, size: line.size, y });
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
    ctx.font = CANVAS_FONT(r.size, r.bold);
    ctx.textAlign = r.align === "center" ? "center" : "left";
    ctx.fillText(r.text, r.align === "center" ? width / 2 : paddingX, r.y);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("Échec de génération de l'image")), "image/png");
  });
}

// ── Composant ticket (un seul exemplaire, pour le client) ───────────────────────
function Ticket({ vente }: { vente: any }) {
  const { caissier, vendeur } = getNoms(vente);

  return (
    <div className="ticket">

      {/* ── EN-TÊTE : logo de la boutique si disponible, sinon son nom ── */}
      <div className="ticket-center ticket-bold" style={{ fontSize: 18, letterSpacing: 0.5 }}>
        {vente.boutique?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vente.boutique.logo} alt={vente.boutique?.nom ?? ""} style={{ maxHeight: 44, maxWidth: "100%" }} />
        ) : (
          vente.boutique?.nom || "Boutique"
        )}
      </div>

      <div className="ticket-sep" />

      {/* ── CAISSIER / VENDEUR ── */}
      {caissier && (
        <div className="ticket-row">
          <span className="ticket-small">Caissier :</span>
          <span className="ticket-small">{caissier}</span>
        </div>
      )}
      {vendeur && (
        <div className="ticket-row">
          <span className="ticket-small">Vendeur :</span>
          <span className="ticket-small">{vendeur}</span>
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

      {/* ── TOTAL ── */}
      <div className="ticket-total">
        <span>TOTAL</span>
        <span className="ticket-mono">{fmt(vente.montantTotal)} F</span>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function PrintVentePage() {
  const { id }           = useParams();
  const [vente,   setVente]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canShare, setCanShare] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    fetch(`/api/ventes/${id}`)
      .then(r => r.json())
      .then(v => { if (v.success) setVente(v.data); })
      .finally(() => setLoading(false));
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
    try {
      await navigator.share({ title: `Ticket ${vente.reference}`, text: buildTicketText(vente) });
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
      const blob = await buildTicketImageBlob(vente);
      const files = [new File([blob], `ticket-${vente.reference}.png`, { type: "image/png" })];
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
          🖨️ Imprimer
        </button>
      </div>

      {/* ── TICKET (un seul exemplaire) ── */}
      <div className="tickets-wrapper">
        <Ticket vente={vente} />
      </div>
    </>
  );
}
