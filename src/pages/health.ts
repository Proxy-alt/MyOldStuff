import type { APIRoute } from 'astro';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import the redis instance and the Type we just created
import { redis } from '../lib/redis';

// --- Caching Variables ---
let cachedCommit: string | null = null;
let cachedVersion: string | null = null;

// --- Setup Paths ---
const __dirname = dirname(fileURLToPath(import.meta.url));
// Adjust '..' amount based on your actual folder structure (e.g., src/pages/api -> ../../..)
const projectRoot = join(__dirname, '../../..');

const SERVER_ID = process.env.SERVER_ID || 'main';
const startTime = Date.now();

// --- Helper Functions ---

function getCommitHash(): string {
  if (cachedCommit) return cachedCommit;
  try {
    const hash = execSync('git rev-parse HEAD', { cwd: projectRoot, encoding: 'utf8' }).trim();
    cachedCommit = hash;
  } catch {
    cachedCommit = 'unknown';
  }
  return cachedCommit as string;
}

function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = join(projectRoot, 'package.json');
    // graceful fail if package.json isn't found
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    cachedVersion = pkg.version ?? 'unknown';
  } catch {
    cachedVersion = 'unknown';
  }
  return cachedVersion as string;
}

/**
 * Determine public status string based on internal metrics.
 * Hides specific numbers (CPU/RAM) from the public response.
 */
async function getSystemStatus(): Promise<string> {
  try {
    // 1. Connectivity Check
    if (redis.status !== 'ready' && redis.status !== 'connect') {
      console.warn('[Health] Redis connection unstable:', redis.status);
      return 'maintenance';
    }

    // 2. Read Heartbeat
    // We try to get the health key written by publishHeartbeat in lib/redis.ts
    const rawHealth = await redis.get(`health:${SERVER_ID}`);

    if (!rawHealth) {
      // Backend hasn't reported in >30s (TTL set in publishHeartbeat)
      return 'unknown';
    }

    // 3. Parse and Type Check
    const health = JSON.parse(rawHealth);

    // 4. Logic Checks

    // Security Priority: If the backend says it's under attack
    if (health.isUnderAttack || health.state === 'ATTACK') {
      return 'mitigating';
    }

    // Load Check: CPU > 85% or Memory > 3.5GB
    if (health.cpu > 85 || health.memory > 3.5) {
      return 'degraded';
    }

    return 'healthy';
  } catch (error) {
    console.error('[Health] Check Error:', error);
    return 'maintenance';
  }
}

// --- The API Handler ---

export const GET: APIRoute = async () => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const currentStatus = await getSystemStatus();

  // Determine HTTP code: 503 if maintenance, 200 otherwise
  // Note: 'mitigating' is still technically a 200 (service is working, just filtering)
  const httpCode = currentStatus === 'maintenance' ? 503 : 200;

  const payload = {
    status: currentStatus,
    timestamp: new Date().toISOString(),
    service: 'petezah-frontend',

    // Metadata
    version: getPackageVersion(),
    commit: getCommitHash(),

    uptime: uptimeSeconds,
    environment: import.meta.env.MODE || process.env.NODE_ENV
  };

  return new Response(JSON.stringify(payload), {
    status: httpCode,
    headers: {
      'Content-Type': 'application/json',
      // Critical: Health checks should never be cached by CDNs or Browsers
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
};
