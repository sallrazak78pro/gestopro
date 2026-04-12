// components/ui/ExportButton.tsx
"use client";
import { useState } from "react";

interface Props {
  type: "ventes" | "tresorerie" | "stock" | "mouvements-stock" | "employes";
  debut?: string;
  fin?: string;
  label?: string;
  className?: string;
}

export default function ExportButton({ type, debut, fin, label, className }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    const params = new URLSearchParams({ type });
    if (debut) params.set("debut", debut);
    if (fin)   params.set("fin",   fin);

    try {
      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) throw new Error("Erreur export");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = res.headers.get("Content-Disposition")
        ?.split("filename=")[1]
        ?.replace(/"/g, "") ?? `${type}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors de l'export.");
    }
    setLoading(false);
  }

  return (
    <button onClick={handleExport} disabled={loading}
      className={className ?? "btn-ghost btn-sm disabled:opacity-60"}>
      {loading
        ? <><svg className="animate-spin w-3.5 h-3.5 mr-1.5 inline" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Export...</>
        : <>{label ?? "📥 Exporter CSV"}</>
      }
    </button>
  );
}
