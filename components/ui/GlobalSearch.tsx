// components/ui/GlobalSearch.tsx
"use client";
import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected,setSelected]= useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  // Raccourci clavier Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (json.success) setResults(json.data);
    setLoading(false);
    setSelected(0);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 280);
    return () => clearTimeout(t);
  }, [query, search]);

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected].href);
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  return (
    <>
      {/* Bouton déclencheur */}
      <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono text-muted hover:text-fg bg-surface2 hover:bg-surface3 border border-border transition-all"
        style={{ minWidth: 160 }}>
        <span>🔍</span>
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="text-[10px] opacity-50">⌘K</kbd>
      </button>

      {/* Bouton mobile */}
      <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="sm:hidden p-2 rounded-xl text-muted hover:text-fg hover:bg-white/5 transition-colors text-lg">
        🔍
      </button>

      {/* Modal de recherche */}
      {open && (
        <div className="fixed inset-0 z-50" onClick={() => { setOpen(false); setQuery(""); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative flex justify-center pt-[10vh] px-4" onClick={e => e.stopPropagation()}>
            <div className="w-full max-w-xl bg-surface border border-border2 rounded-2xl shadow-2xl overflow-hidden">

              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                <span className="text-muted text-lg shrink-0">🔍</span>
                <input ref={inputRef}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                  style={{ color: "var(--color-fg)" }}
                  placeholder="Rechercher une vente, un produit, un client…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                />
                {loading && (
                  <svg className="animate-spin w-4 h-4 text-muted shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                <kbd onClick={() => { setOpen(false); setQuery(""); }}
                  className="text-[10px] font-mono text-muted bg-surface2 border border-border px-1.5 py-0.5 rounded cursor-pointer shrink-0">
                  Esc
                </kbd>
              </div>

              {/* Résultats */}
              {results.length > 0 ? (
                <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: "var(--color-border)" }}>
                  {results.map((r, i) => (
                    <button key={i} onClick={() => navigate(r.href)}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        i === selected ? "bg-accent/10" : "hover:bg-white/5"
                      )}>
                      <span className="text-xl shrink-0">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-fg)" }}>{r.label}</p>
                        <p className="text-xs text-muted truncate">{r.sub}</p>
                      </div>
                      <span className="text-[10px] font-mono text-muted shrink-0 capitalize">{r.type}</span>
                    </button>
                  ))}
                </div>
              ) : query.length >= 2 && !loading ? (
                <div className="px-4 py-8 text-center text-muted font-mono text-sm">
                  Aucun résultat pour « {query} »
                </div>
              ) : query.length < 2 ? (
                <div className="px-4 py-6 text-center text-muted font-mono text-xs">
                  Tapez au moins 2 caractères…
                </div>
              ) : null}

              {/* Aide clavier */}
              {results.length > 0 && (
                <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-surface2">
                  <span className="text-[10px] font-mono text-muted">↑↓ Naviguer</span>
                  <span className="text-[10px] font-mono text-muted">↵ Ouvrir</span>
                  <span className="text-[10px] font-mono text-muted">Esc Fermer</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
