// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GestoPro — Hors ligne</title>
        <style>{`
          * { margin:0; padding:0; box-sizing:border-box; }
          body {
            background: #0b0b18;
            color: #e2e8f0;
            font-family: system-ui, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            background: #12122a;
            border: 1px solid #1e2040;
            border-radius: 24px;
            padding: 48px 40px;
            max-width: 420px;
            width: 100%;
            text-align: center;
          }
          .logo {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: -1px;
            margin-bottom: 32px;
          }
          .logo span { color: #00d4ff; }
          .icon { font-size: 64px; margin-bottom: 24px; }
          h1 { font-size: 22px; font-weight: 800; margin-bottom: 12px; }
          p  { font-size: 14px; color: #64748b; line-height: 1.7; margin-bottom: 8px; }
          .btn {
            display: inline-block;
            margin-top: 28px;
            background: #00d4ff;
            color: #000;
            font-weight: 700;
            font-size: 14px;
            padding: 12px 28px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            text-decoration: none;
          }
          .tip {
            margin-top: 24px;
            padding: 14px 16px;
            background: rgba(0,212,255,0.05);
            border: 1px solid rgba(0,212,255,0.15);
            border-radius: 12px;
            font-size: 12px;
            color: #64748b;
            line-height: 1.6;
          }
          .tip strong { color: #00d4ff; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="logo">Gesto<span>Pro</span></div>
          <div className="icon">📡</div>
          <h1>Connexion interrompue</h1>
          <p>Vous êtes actuellement hors ligne.<br/>Vérifiez votre connexion internet.</p>
          <p>Les données récemment consultées restent accessibles depuis le cache.</p>
          <a href="/dashboard" className="btn">↩ Réessayer</a>
          <div className="tip">
            <strong>Astuce :</strong> Installez GestoPro sur votre écran d'accueil pour un accès rapide même avec une connexion limitée.
          </div>
        </div>
      </body>
    </html>
  );
}
