// components/ui/Pagination.tsx
"use client";
import clsx from "clsx";

interface Props {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onChange }: Props) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  // Générer les numéros de pages à afficher
  const nums: (number | "...")[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) nums.push(i);
  } else {
    nums.push(1);
    if (page > 3) nums.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) nums.push(i);
    if (page < pages - 2) nums.push("...");
    nums.push(pages);
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t flex-wrap gap-3"
      style={{ borderColor: "var(--color-border)" }}>
      <p className="text-xs font-mono text-muted">
        {start}–{end} sur {new Intl.NumberFormat("fr-FR").format(total)} résultats
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="btn-ghost btn-sm px-2 disabled:opacity-30">←</button>

        {nums.map((n, i) =>
          n === "..." ? (
            <span key={i} className="px-2 text-muted font-mono text-xs">…</span>
          ) : (
            <button key={i} onClick={() => onChange(n as number)}
              className={clsx(
                "w-8 h-8 rounded-lg text-xs font-mono font-semibold transition-all",
                n === page
                  ? "bg-accent text-bg"
                  : "text-muted2 hover:bg-white/5 hover:text-fg"
              )}>
              {n}
            </button>
          )
        )}

        <button onClick={() => onChange(page + 1)} disabled={page === pages}
          className="btn-ghost btn-sm px-2 disabled:opacity-30">→</button>
      </div>
    </div>
  );
}
