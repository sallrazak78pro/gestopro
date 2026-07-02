// lib/utils/rateLimit.ts
// Limite les tentatives de connexion en mémoire (reset au redémarrage)
// Pour la production, utiliser Redis ou MongoDB si besoin de persistance

const attempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;       // tentatives max
const WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const BLOCK_MS     = 30 * 60 * 1000; // blocage 30 minutes après dépassement

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  // Pas d'entrée ou fenêtre expirée — réinitialiser
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  // Trop de tentatives
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}

// Extrait l'IP du client depuis les headers (Vercel/proxy-friendly)
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Nettoyage périodique des entrées expirées (évite les fuites mémoire)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts.entries()) {
    if (now > entry.resetAt + BLOCK_MS) attempts.delete(key);
  }
}, 5 * 60 * 1000);
