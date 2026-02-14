import type { MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';

interface IPReputationData {
  score: number;
  lastSeen: number;
  violations: Array<{ time: number; score: number }>;
}

interface RequestFingerprint {
  count: number;
  lastSeen: number;
  ip: string;
}

interface CircuitBreaker {
  open: boolean;
  until: number;
  violations: number;
  xdpBlocked?: boolean;
}

// In-memory stores for middleware
const requestFingerprints = new Map<string, RequestFingerprint>();
const ipReputation = new Map<string, IPReputationData>();
const circuitBreakers = new Map<string, CircuitBreaker>();

const MAX_FINGERPRINTS = 10000;
const MAX_IP_REPUTATION = 5000;
const MAX_CIRCUIT_BREAKERS = 1000;

/**
 * Extract IPv4 from request headers
 */
function toIPv4(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfIP = req.headers.get('cf-connecting-ip');
  const trueClientIP = req.headers.get('true-client-ip');

  let ip: string | null = null;

  if (forwarded) {
    ip = forwarded.split(',')[0].trim();
  } else if (cfIP) {
    ip = cfIP;
  } else if (trueClientIP) {
    ip = trueClientIP;
  } else if (realIP) {
    ip = realIP;
  }

  if (!ip) return '127.0.0.1';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

  const match = ip.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  return match ? match[0] : '127.0.0.1';
}

/**
 * Create request fingerprint
 */
function createFingerprint(req: Request, ip: string): string {
  const ua = req.headers.get('user-agent') || '';
  const accept = req.headers.get('accept') || '';
  const lang = req.headers.get('accept-language') || '';
  const encoding = req.headers.get('accept-encoding') || '';
  const data = `${ip}:${ua}:${accept}:${lang}:${encoding}`;

  return data
    .split('')
    .reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0)
    .toString(16);
}

/**
 * Update IP reputation
 */
function updateIPReputation(ip: string, score: number): void {
  const current = ipReputation.get(ip) || { score: 0, lastSeen: 0, violations: [] };
  current.score += score;
  current.lastSeen = Date.now();
  if (score < 0) {
    current.violations.push({ time: Date.now(), score });
    if (current.violations.length > 100) {
      current.violations.shift();
    }
  }
  ipReputation.set(ip, current);

  if (current.score < -100) {
    circuitBreakers.set(ip, { open: true, until: Date.now() + 3600000, violations: current.violations.length });
  }
}

/**
 * Check circuit breaker
 */
function checkCircuitBreaker(ip: string): boolean {
  const breaker = circuitBreakers.get(ip);
  if (!breaker) return false;

  if (breaker.open && Date.now() > breaker.until) {
    circuitBreakers.delete(ip);
    return false;
  }

  return breaker.open;
}

/**
 * Cleanup old entries periodically
 */
function cleanupOldEntries(): void {
  const now = Date.now();

  if (requestFingerprints.size > MAX_FINGERPRINTS) {
    const entries = Array.from(requestFingerprints.entries());
    entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = entries.slice(0, Math.floor(MAX_FINGERPRINTS * 0.3));
    toRemove.forEach(([key]) => requestFingerprints.delete(key));
  }

  if (ipReputation.size > MAX_IP_REPUTATION) {
    const entries = Array.from(ipReputation.entries());
    entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = entries.slice(0, Math.floor(MAX_IP_REPUTATION * 0.3));
    toRemove.forEach(([key]) => ipReputation.delete(key));
  }

  if (circuitBreakers.size > MAX_CIRCUIT_BREAKERS) {
    const entries = Array.from(circuitBreakers.entries());
    entries.sort((a, b) => (b[1].until || 0) - (a[1].until || 0));
    const toRemove = entries.slice(MAX_CIRCUIT_BREAKERS);
    toRemove.forEach(([key]) => circuitBreakers.delete(key));
  }

  for (const [key, value] of Array.from(requestFingerprints.entries())) {
    if (now - value.lastSeen > 300000) {
      requestFingerprints.delete(key);
    }
  }

  for (const [ip, rep] of Array.from(ipReputation.entries())) {
    if (now - rep.lastSeen > 3600000) {
      ipReputation.delete(ip);
    }
  }

  for (const [ip, breaker] of Array.from(circuitBreakers.entries())) {
    if (breaker.open && now > breaker.until) {
      circuitBreakers.delete(ip);
    }
  }
}

// Run cleanup every minute
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupOldEntries, 60000);
}

/**
 * Main middleware for all Astro routes
 * Handles security, rate limiting, fingerprinting
 * Skips API and proxy routes (handled by Fastify)
 */
export const onRequest = defineMiddleware(async (context, next: MiddlewareNext) => {
  const { request } = context;
  const ip = toIPv4(request);
  const path = new URL(request.url).pathname;

  // Skip API routes (handled by Fastify)
  if (path.startsWith('/api/')) {
    return next();
  }

  // Skip proxy routes (handled by Fastify)
  if (
    path.startsWith('/bare/') ||
    path.startsWith('/wisp/') ||
    path.startsWith('/scram/') ||
    path.startsWith('/baremux/') ||
    path.startsWith('/epoxy/')
  ) {
    return next();
  }

  // Check circuit breaker
  if (checkCircuitBreaker(ip)) {
    return new Response('Too many requests', { status: 429 });
  }

  // Request fingerprinting
  const fingerprint = createFingerprint(request, ip);
  const fpData = requestFingerprints.get(fingerprint) || { count: 0, lastSeen: 0, ip };
  fpData.count++;
  fpData.lastSeen = Date.now();
  requestFingerprints.set(fingerprint, fpData);

  if (fpData.count > 1000 && Date.now() - fpData.lastSeen < 60000) {
    updateIPReputation(ip, -20);
    return new Response('Too many requests', { status: 429 });
  }

  // Check header size
  const totalHeaderSize: number = Array.from(request.headers.entries()).reduce(
    (sum, [k, v]) => sum + k.length + (typeof v === 'string' ? v.length : 0),
    0
  );

  if (totalHeaderSize > 16384) {
    updateIPReputation(ip, -15);
    return new Response('Headers too large', { status: 431 });
  }

  // Continue to the next middleware/route
  return next();
});
