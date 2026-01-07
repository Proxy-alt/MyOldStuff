import type { APIRoute } from 'astro';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Cache variables (module scope = cached across requests)
let cachedCommit: string | null = null;
let cachedVersion: string | null = null;

// Resolve project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..'); // adjust if needed

function getCommitHash() {
  if (cachedCommit) return cachedCommit;

  try {
    const hash = execSync('git rev-parse HEAD', {
      cwd: projectRoot,
      encoding: 'utf8'
    }).trim();

    cachedCommit = hash;
  } catch {
    cachedCommit = 'unknown';
  }

  return cachedCommit;
}

function getPackageVersion() {
  if (cachedVersion) return cachedVersion;

  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

    cachedVersion = pkg.version ?? 'unknown';
  } catch {
    cachedVersion = 'unknown';
  }

  return cachedVersion;
}

const startTime = Date.now();

export const GET: APIRoute = async () => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const payload = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'astro-frontend',

    // Cached metadata
    version: getPackageVersion(),
    commit: getCommitHash(),

    uptime: uptimeSeconds,
    environment: import.meta.env.MODE
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
