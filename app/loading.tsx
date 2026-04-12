// app/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--color-bg)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-white text-lg"
          style={{ background: "linear-gradient(135deg, #00d4ff, #7c3aed)" }}>
          G
        </div>
        <div className="flex items-center gap-2 text-muted font-mono text-sm">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Chargement...
        </div>
      </div>
    </div>
  );
}
