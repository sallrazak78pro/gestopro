// components/ui/PrintButton.tsx
"use client";

interface Props {
  href: string;          // URL de la page d'impression
  label?: string;        // Texte du bouton (défaut: "Imprimer")
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
}

export default function PrintButton({ href, label = "🖨️ Imprimer", variant = "ghost", size = "sm" }: Props) {
  const handleClick = () => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const cls = variant === "primary" ? "btn-primary"
    : variant === "outline"  ? "btn-outline"
    : "btn-ghost";
  const szCls = size === "sm" ? "btn-sm" : "";

  return (
    <button type="button" onClick={handleClick} className={`${cls} ${szCls}`}>
      {label}
    </button>
  );
}
