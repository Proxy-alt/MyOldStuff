import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import bareServerPkg from '@tomphttp/bare-server-node';
import compression from 'compression';
import cors from 'cors';
import { createHash, randomBytes, randomUUID } from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fetch from 'node-fetch';
import { createServer } from 'node:http';
import { hostname } from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'perf_hooks';
import process from 'process';
import v8 from 'v8';
import { ddosShield } from './secure.js';
import { blockIPKernel } from './xdp-integration.js';
import { startAstroDev, stopAstroDev, getAstroDev, isAstroRunning, handleAstroRequest } from './server/astro-integration.js';

const { createBareServer } = bareServerPkg;

dotenv.config();

const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

// Parse command-line arguments for development mode
const isDev = process.argv.includes('--dev');
const devPort = 3001;
console.log(`[Server] Starting in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = 'public';

const MAX_REQUEST_SIZE = 10 * 1024 * 1024;
const MAX_JSON_SIZE = 5 * 1024 * 1024;
const MAX_HEADER_SIZE = 16384;
const MEMORY_THRESHOLD = 1024 * 1024 * 1024 * 2;
const MEMORY_CRITICAL = 1024 * 1024 * 1024 * 1.5;
const REQUEST_TIMEOUT = 60000;
const PAYLOAD_TIMEOUT = 30000;
const CPU_THRESHOLD = 75;
const MAX_FINGERPRINTS = 10000;
const MAX_IP_REPUTATION = 5000;
const MAX_CIRCUIT_BREAKERS = 1000;
const MAX_ACTIVE_REQUESTS = 5000;
// Bot cache constant removed - bot detection disabled
const MAX_WS_CONNECTIONS = 5000;

const memoryPressure = { active: false, lastCheck: 0, consecutiveHigh: 0 };
const requestFingerprints = new Map();
const ipReputation = new Map();
const circuitBreakers = new Map();
const activeRequests = new Map();
let requestIdCounter = 0;

// Minification handled by Astro build process
function getMemoryUsage() {
  const mem = process.memoryUsage();

  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers || 0
  };
}

function createFingerprint(req) {
  const ip = toIPv4(null, req);
  const ua = req.headers['user-agent'] || '';
  const accept = req.headers['accept'] || '';
  const lang = req.headers['accept-language'] || '';
  const encoding = req.headers['accept-encoding'] || '';
  const data = `${ip}:${ua}:${accept}:${lang}:${encoding}`;
  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

function updateIPReputation(ip, score) {
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

function checkCircuitBreaker(ip) {
  const breaker = circuitBreakers.get(ip);
  if (!breaker) return false;

  if (breaker.open && Date.now() > breaker.until) {
    circuitBreakers.delete(ip);
    return false;
  }

  const shouldXDPBlock = breaker.open && !breaker.xdpBlocked && breaker.violations > 100 && systemState.state === 'ATTACK' && !systemState.cpuHigh;

  if (shouldXDPBlock) {
    breaker.xdpBlocked = true;

    blockIPKernel(ip, shield)
      .then((success) => {
        if (success) {
          shield.sendLog(`🛡️ **XDP ENGAGED**: ${ip} (${breaker.violations} violations)`, null);
        }
      })
      .catch((err) => {
        console.error('[XDP] Block failed:', err);
      });
  }

  return breaker.open;
}

function toIPv4(ip, req = null) {
  if (req) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const xRealIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip'];
    const trueClientIP = req.headers['true-client-ip'];

    if (xForwardedFor) {
      ip = xForwardedFor.split(',')[0].trim();
    } else if (cfConnectingIP) {
      ip = cfConnectingIP;
    } else if (trueClientIP) {
      ip = trueClientIP;
    } else if (xRealIP) {
      ip = xRealIP;
    } else if (req.socket?.remoteAddress) {
      ip = req.socket.remoteAddress;
    } else if (req.connection?.remoteAddress) {
      ip = req.connection.remoteAddress;
    }
  }

  if (!ip) return '127.0.0.1';
  if (typeof ip === 'string' && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  const match = typeof ip === 'string' ? ip.match(/^(\d{1,3}\.){3}\d{1,3}$/) : null;
  return match ? match[0] : '127.0.0.1';
}

const bare = createBareServer('/bare/', {
  websocket: { maxPayloadLength: 4096 }
});

const barePremium = createBareServer('/api/bare-premium/', {
  websocket: { maxPayloadLength: 4096 }
});

const app = express();

app.set('trust proxy', ['127.0.0.1', '::1', '51.222.141.36']);
// if your self hosting u can change this

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const shield = ddosShield(discordClient);

discordClient.login(process.env.BOT_TOKEN).catch((err) => {
  console.error('Failed to login Discord bot:', err.message);
});

shield.registerCommands(discordClient);

if (!process.env.TOKEN_SECRET) {
  throw new Error('CRITICAL: TOKEN_SECRET environment variable must be set');
}
const TOKEN_SECRET = process.env.TOKEN_SECRET;
const TOKEN_VALIDITY = 3600000;
const BASE_POW_DIFFICULTY = 16;
const MAX_POW_DIFFICULTY = 22;

const baselineMetrics = {
  cpuSamples: [],
  requestRateSamples: [],
  blockRateSamples: [],
  uniqueIpSamples: [],
  lastBaselineUpdate: Date.now(),
  baselineCpu: 30,
  baselineRequestRate: 100,
  baselineBlockRate: 5,
  baselineUniqueIps: 50
};

const requestRateTracker = {
  requests: [],
  lastMinuteStart: Date.now()
};

const systemState = {
  state: 'NORMAL',
  cpuHigh: false,
  activeConnections: 0,
  totalWS: 0,
  totalRequests: 0,
  lastCheck: Date.now(),
  currentPowDifficulty: BASE_POW_DIFFICULTY,
  recentBlockRate: 0,
  lastDifficultyAdjust: Date.now(),
  trustedClients: new Set(),
  lastPowSolve: new Map(),
  requestRatePerMinute: 0
};

discordClient.systemState = systemState;

// Bot verification removed - Astro handles bot filtering

function updateBaseline() {
  const now = Date.now();
  if (now - baselineMetrics.lastBaselineUpdate < 60000) return;

  baselineMetrics.lastBaselineUpdate = now;
  const cpuUsage = shield.getCpuUsage();
  const blockRate = shield.getRecentBlockRate();
  const requestRate = systemState.totalRequests / ((now - systemState.lastCheck) / 1000) || 0;
  const { uniqueIps } = shield.getChallengeSpike();

  baselineMetrics.cpuSamples.push(cpuUsage);
  baselineMetrics.requestRateSamples.push(requestRate);
  baselineMetrics.blockRateSamples.push(blockRate);
  baselineMetrics.uniqueIpSamples.push(uniqueIps);

  const maxSamples = 10;
  if (baselineMetrics.cpuSamples.length > maxSamples) {
    baselineMetrics.cpuSamples.shift();
    baselineMetrics.requestRateSamples.shift();
    baselineMetrics.blockRateSamples.shift();
    baselineMetrics.uniqueIpSamples.shift();
  }

  if (baselineMetrics.cpuSamples.length >= 3) {
    baselineMetrics.baselineCpu = baselineMetrics.cpuSamples.reduce((a, b) => a + b, 0) / baselineMetrics.cpuSamples.length;
    baselineMetrics.baselineRequestRate = baselineMetrics.requestRateSamples.reduce((a, b) => a + b, 0) / baselineMetrics.requestRateSamples.length;
    baselineMetrics.baselineBlockRate = baselineMetrics.blockRateSamples.reduce((a, b) => a + b, 0) / baselineMetrics.blockRateSamples.length;
    baselineMetrics.baselineUniqueIps = baselineMetrics.uniqueIpSamples.reduce((a, b) => a + b, 0) / baselineMetrics.uniqueIpSamples.length;
  }
}

function adjustPowDifficulty(req = null) {
  const now = Date.now();
  if (now - systemState.lastDifficultyAdjust < 10000) return;

  systemState.lastDifficultyAdjust = now;
  updateBaseline();

  const token = req ? extractToken(req) : null;
  const tokenData = req ? verifyToken(token, req) : null;
  const isTrusted = tokenData?.features?.http || (req && req.session?.user) || false;

  if (isTrusted) {
    systemState.currentPowDifficulty = BASE_POW_DIFFICULTY;
    return;
  }

  if (baselineMetrics.baselineCpu === 0 || baselineMetrics.cpuSamples.length < 3) {
    systemState.currentPowDifficulty = BASE_POW_DIFFICULTY;
    return;
  }

  const blockRate = shield.getRecentBlockRate();
  const cpuUsage = shield.getCpuUsage();
  const { uniqueIps } = shield.getChallengeSpike();

  const cpuSpike = cpuUsage > baselineMetrics.baselineCpu * 1.2;
  const cpuBusy = cpuUsage > baselineMetrics.baselineCpu * 1.1;
  const ipChurnHigh = uniqueIps > baselineMetrics.baselineUniqueIps * 2;

  const isAttack = shield.isUnderAttack || systemState.state === 'ATTACK';
  const isBusy = systemState.state === 'BUSY' || (cpuBusy && !isAttack);

  if (isBusy && !isAttack) {
    systemState.currentPowDifficulty = BASE_POW_DIFFICULTY;
    return;
  }

  let targetDifficulty = BASE_POW_DIFFICULTY;

  if (isAttack && ipChurnHigh) {
    targetDifficulty = MAX_POW_DIFFICULTY;
  } else if (isAttack) {
    targetDifficulty = 20;
  } else if (ipChurnHigh && blockRate > baselineMetrics.baselineBlockRate * 2) {
    targetDifficulty = 18;
  }

  targetDifficulty = Math.min(Math.max(targetDifficulty, BASE_POW_DIFFICULTY), MAX_POW_DIFFICULTY);

  if (targetDifficulty > systemState.currentPowDifficulty) {
    systemState.currentPowDifficulty = Math.min(targetDifficulty, MAX_POW_DIFFICULTY);
  } else if (targetDifficulty < systemState.currentPowDifficulty) {
    systemState.currentPowDifficulty = Math.max(systemState.currentPowDifficulty - 1, BASE_POW_DIFFICULTY);
  }
}

// Bot verification removed

setInterval(() => {
  const now = Date.now();
}, 300000);

// Bot verification removed

function createToken(features = { http: true, ws: true }) {
  const now = Date.now();
  const expiry = now + TOKEN_VALIDITY;
  const payload = JSON.stringify({
    iat: now,
    exp: expiry,
    features
  });
  const hmac = createHmac('sha256', TOKEN_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

function verifyToken(token, req) {
  if (!token || typeof token !== 'string' || token.length > 512) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  try {
    if (parts[0].length > 512 || parts[1].length > 128) return null;

    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const signature = parts[1];

    if (payload.length > 1024) return null;

    const hmac = createHmac('sha256', TOKEN_SECRET);
    hmac.update(payload);
    const expected = hmac.digest('base64url');

    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const data = JSON.parse(payload);
    if (!data.iat || !data.exp || typeof data.iat !== 'number' || typeof data.exp !== 'number') return null;
    if (data.exp < Date.now()) return null;
    if (data.iat > Date.now() + 1000) return null;
    if (data.exp - data.iat > TOKEN_VALIDITY + 1000) return null;

    if (req && data.fp) {
      const ip = toIPv4(null, req);
      const ua = req.headers['user-agent'] || '';
      const currentFP = createHmac('sha256', TOKEN_SECRET)
        .update(ip + ua)
        .digest('hex')
        .slice(0, 16);
      if (data.fp.length !== currentFP.length) return null;
      if (!timingSafeEqual(Buffer.from(data.fp), Buffer.from(currentFP))) return null;
    }

    return data;
  } catch {
    return null;
  }
}

function checkSystemPressure() {
  const now = Date.now();
  const timeDelta = (now - systemState.lastCheck) / 1000;
  if (timeDelta < 1) return systemState.cpuHigh;

  const previousCheck = systemState.lastCheck;
  systemState.lastCheck = now;
  updateBaseline();

  requestRateTracker.requests.push(now);
  requestRateTracker.requests = requestRateTracker.requests.filter((t) => now - t < 60000);
  systemState.requestRatePerMinute = requestRateTracker.requests.length;

  const cpuUsage = shield.getCpuUsage();
  const requestRate = timeDelta > 0 ? systemState.totalRequests / timeDelta : 0;
  const blockRate = shield.getRecentBlockRate();
  const blockRatio = requestRate > 0 ? blockRate / requestRate : 0;

  const cpuSpike = cpuUsage > baselineMetrics.baselineCpu * 1.2;
  const cpuBusy = cpuUsage > baselineMetrics.baselineCpu * 1.1;
  const blockRatioHigh = blockRatio > 0.3;

  if (cpuSpike && blockRatioHigh && systemState.state !== 'ATTACK') {
    systemState.state = 'ATTACK';
  } else if (cpuBusy && !blockRatioHigh && systemState.state === 'NORMAL') {
    systemState.state = 'BUSY';
  } else if (!cpuBusy && systemState.state !== 'NORMAL') {
    systemState.state = 'NORMAL';
  }

  systemState.cpuHigh = cpuUsage > CPU_THRESHOLD || systemState.activeConnections > 25000;
  systemState.totalRequests = 0;

  return systemState.cpuHigh;
}

function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/bot_token=([^;]+)/);
    if (match) return match[1];
  }

  return null;
}

app.use(cookieParser());
app.use(compression({ level: 6, threshold: 1024 }));

const fileManifest = new Map();
const processedHtmlCache = new Map();

const MAX_HTML_CACHE = 100;
const MAX_FILE_MANIFEST = 1000;

function generateObfuscatedPath(originalPath) {
  if (!originalPath.startsWith('/storage/js/') && !originalPath.startsWith('/storage/css/')) {
    return originalPath;
  }

  if (fileManifest.has(originalPath)) return fileManifest.get(originalPath);

  if (fileManifest.size > MAX_FILE_MANIFEST) {
    const firstKey = fileManifest.keys().next().value;
    fileManifest.delete(firstKey);
  }

  const hash = createHash('sha256')
    .update(originalPath + TOKEN_SECRET)
    .digest('hex')
    .slice(0, 16);
  const ext = path.extname(originalPath);
  const dir = path.dirname(originalPath);
  const obfuscated = `${dir}/${hash}${ext}`;

  fileManifest.set(originalPath, obfuscated);
  fileManifest.set(obfuscated, originalPath);

  return obfuscated;
}

app.use((req, res, next) => {
  const original = fileManifest.get(req.path);
  if (original) {
    req.url = original;
  }
  next();
});

app.use((req, res, next) => {
  let filePath;

  if (req.path === '/' || req.path === '') {
    filePath = path.join(__dirname, publicPath, 'index.html');
  } else if (req.path.endsWith('.html')) {
    filePath = path.join(__dirname, publicPath, req.path);
  } else {
    return next();
  }

  if (!fs.existsSync(filePath)) return next();

  const stat = fs.statSync(filePath);
  const cacheKey = `${filePath}:${stat.mtimeMs}`;

  if (processedHtmlCache.has(cacheKey)) {
    return res.type('html').send(processedHtmlCache.get(cacheKey));
  }

  if (processedHtmlCache.size > MAX_HTML_CACHE) {
    const firstKey = processedHtmlCache.keys().next().value;
    processedHtmlCache.delete(firstKey);
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return next();

    const processed = data.replace(/\/?storage\/(js|css)\/([^"'\s<>]+\.(js|css))/g, (match, type, file) => {
      const fullPath = `/storage/${type}/${file}`;
      return generateObfuscatedPath(fullPath);
    });

    processedHtmlCache.set(cacheKey, processed);
    res.type('html').send(processed);
  });
});

console.log('[OBFUSCATION] Middleware loaded');

app.use(express.static(publicPath));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(
  '/storage/data',
  express.static(path.join(__dirname, 'storage', 'data'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.json')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i.test(path)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  })
);

app.use('/scram/', express.static(scramjetPath));
app.get('/scramjet.all.js', (req, res) => res.sendFile(path.join(scramjetPath, 'scramjet.all.js')));
app.get('/scramjet.sync.js', (req, res) => res.sendFile(path.join(scramjetPath, 'scramjet.sync.js')));
app.get('/scramjet.wasm.wasm', (req, res) => res.sendFile(path.join(scramjetPath, 'scramjet.wasm.wasm')));
app.get('/scramjet.all.js.map', (req, res) => res.sendFile(path.join(scramjetPath, 'scramjet.all.js.map')));

app.use('/baremux/', express.static(baremuxPath));
app.use('/epoxy/', express.static(epoxyPath));


// Bot challenge endpoint removed - bot detection disabled
// Bot verify endpoint removed - bot detection disabled

const gateMiddleware = async (req, res, next) => {
  systemState.totalRequests++;

  const ua = req.headers['user-agent'] || '';
  const ip = toIPv4(null, req);
  const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/i.test(ua);

  // Bot detection removed - Astro middleware handles filtering
  if (isBrowser) {
    return next();
  }

  const token = extractToken(req);
  const tokenData = verifyToken(token, req);
  const fingerprint = createFingerprint(req);
  const isTrusted = tokenData?.features?.http || req.session?.user || systemState.trustedClients.has(fingerprint);

  if (isTrusted) {
    return next();
  }

  const pressureState = checkSystemPressure();
  if (pressureState && systemState.state === 'ATTACK') {
    shield.incrementBlocked(ip, 'pressure');
    return res.status(503).send('Service temporarily unavailable');
  }

  const baseline = {
    baselineCpu: baselineMetrics.baselineCpu,
    baselineRequestRate: baselineMetrics.baselineRequestRate,
    baselineBlockRate: baselineMetrics.baselineBlockRate,
    baselineUniqueIps: baselineMetrics.baselineUniqueIps
  };

  if (Math.random() < 0.1) {
    shield.checkAttackConditions(ip, { ...systemState, ...baseline });
  }

  adjustPowDifficulty(req);

  const acceptsHtml = req.headers.accept?.includes('text/html');
  if (acceptsHtml && isBrowser) {
    return res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Loading...</title></head>
<body>
<script>
(async()=>{
const r=await fetch('/api/bot-challenge');
const {challenge,difficulty}=await r.json();
const start=performance.now();
let nonce=0;
let hash='';
while(true){
const data=challenge+nonce;
const buf=new TextEncoder().encode(data);
const hashBuf=await crypto.subtle.digest('SHA-256',buf);
hash=Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
const zeros=hash.match(/^0+/)?.[0].length||0;
if(zeros>=Math.floor(difficulty/4))break;
nonce++;
if(nonce>2000000)break;
}
const timing=performance.now()-start;
const v=await fetch('/api/bot-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge,nonce,timing})});
if(v.ok)location.reload();
else document.body.innerHTML='<p>Verification failed. Please refresh.</p>';
})();
</script>
</body>
</html>`);
  }

  shield.incrementBlocked(ip, 'no_token');
  return res.status(403).send('Forbidden');
};

const authRoutes = ['/api/signin', '/api/signup', '/api/verify-email'];
const apiRoutes = [
  '/api/signin',
  '/api/signup',
  '/api/verify-email',
  '/api/signout',
  '/api/profile',
  '/api/update-profile',
  '/api/load-localstorage',
  '/api/delete-account',
  '/api/changelog',
  '/api/feedback',
  '/api/comment',
  '/api/comments',
  '/api/like',
  '/api/likes',
  '/api/upload-profile-pic',
  '/api/save-localstorage',
  '/api/change-password',
  '/api/admin/user-action',
  '/api/admin/feedback',
  '/api/admin/stats',
  '/api/admin/users'
];
const authPaths = new Set(authRoutes);
const apiPaths = new Set(apiRoutes);

const memoryProtection = (req, res, next) => {
  if (checkMemoryPressure()) {
    const ip = toIPv4(null, req);
    updateIPReputation(ip, -5);
    shield.trackMemoryPressure(ip);
    if (!apiPaths.has(req.path)) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
  }

  const reqId = ++requestIdCounter;
  const startTime = performance.now();
  activeRequests.set(reqId, { ip: toIPv4(null, req), path: req.path, startTime });

  req.on('close', () => activeRequests.delete(reqId));
  req.on('end', () => activeRequests.delete(reqId));

  res.on('finish', () => {
    activeRequests.delete(reqId);
    const duration = performance.now() - startTime;
    if (duration > REQUEST_TIMEOUT) {
      const ip = toIPv4(null, req);
      updateIPReputation(ip, -2);
    }
  });

  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > MAX_REQUEST_SIZE) {
    const ip = toIPv4(null, req);
    updateIPReputation(ip, -10);
    shield.incrementBlocked(ip, 'payload_oversized');
    return res.status(413).json({ error: 'Request too large' });
  }

  const totalHeaderSize = Object.entries(req.headers).reduce(
    (sum, [k, v]) => sum + k.length + (Array.isArray(v) ? v.join('').length : String(v).length),
    0
  );
  if (totalHeaderSize > MAX_HEADER_SIZE) {
    const ip = toIPv4(null, req);
    updateIPReputation(ip, -15);
    shield.incrementBlocked(ip, 'header_oversized');
    return res.status(431).json({ error: 'Headers too large' });
  }

  const fingerprint = createFingerprint(req);
  const ip = toIPv4(null, req);
  const fpData = requestFingerprints.get(fingerprint) || { count: 0, lastSeen: 0, ip };
  fpData.count++;
  fpData.lastSeen = Date.now();
  requestFingerprints.set(fingerprint, fpData);

  if (fpData.count > 1000 && Date.now() - fpData.lastSeen < 60000) {
    updateIPReputation(ip, -20);
    shield.incrementBlocked(ip, 'fingerprint_abuse');
    return res.status(429).json({ error: 'Too many requests' });
  }

  next();
};

const assetExtensions = new Set([
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.ico',
  '.wasm',
  '.map',
  '.json',
  '.xml',
  '.txt',
  '.pdf',
  '.mp3',
  '.mp4',
  '.ogg',
  '.wav',
  '.avi',
  '.mov',
  '.zip',
  '.rar',
  '.bin'
]);
const assetPaths = [
  '/storage/',
  '/static/',
  '/uploads/',
  '/scram/',
  '/baremux/',
  '/epoxy/',
  '/bare/',
  '/api/bare-premium/',
  '/wisp/',
  '/api/wisp-premium/',
  '/api/alt-wisp-1/',
  '/api/alt-wisp-2/',
  '/api/alt-wisp-3/',
  '/api/alt-wisp-4/',
  '/pages/'
];

const conditionalGate = (req, res, next) => {
  const path = req.path.split('?')[0].toLowerCase();
  const extIndex = path.lastIndexOf('.');
  const hasExtension = extIndex > 0 && extIndex < path.length - 1;
  const extension = hasExtension ? path.substring(extIndex) : '';

  const isAsset =
    (hasExtension && assetExtensions.has(extension)) ||
    assetPaths.some((p) => path.startsWith(p.toLowerCase())) ||
    /\.(js|css|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|otf|ico|wasm|map|json|xml|mp3|mp4|ogg|wav|bin)$/i.test(path);

  if (isAsset) {
    return next();
  }

  const ip = toIPv4(null, req);

  if (checkCircuitBreaker(ip)) {
    shield.incrementBlocked(ip, 'circuit_open');
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (apiPaths.has(req.path)) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return next();
  }

  if (!req.route && req.app._router) {
    const matched = req.app._router.stack.some((layer) => {
      if (layer.route) return layer.route.path === req.path;
      return false;
    });
    if (!matched) return next();
  }

  return gateMiddleware(req, res, next);
};

app.use(memoryProtection);
app.use(conditionalGate);

const authLimiter = rateLimit({
  windowMs: 60000,
  max: 60,
  keyGenerator: (req) => toIPv4(null, req),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = toIPv4(null, req);
    const reputation = ipReputation.get(ip);
    return reputation && reputation.score < -50;
  },
  handler: (req, res) => {
    const ip = toIPv4(null, req);
    updateIPReputation(ip, -5);
    res.status(429).json({ error: 'Too many authentication attempts' });
  }
});

const apiLimiter = rateLimit({
  windowMs: 15000,
  max: (req) => {
    const token = extractToken(req);
    const ip = toIPv4(null, req);
    const reputation = ipReputation.get(ip);
    if (reputation && reputation.score < -50) return 10;
    if (authPaths.has(req.path)) return 20;
    return verifyToken(token, req) ? 200 : 50;
  },
  keyGenerator: (req) => {
    const token = extractToken(req);
    if (verifyToken(token, req)) return `token:${token.slice(0, 16)}`;
    const ip = toIPv4(null, req);
    if (req.session?.user?.id) return `user:${req.session.user.id}`;
    return ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => false,
  handler: (req, res) => {
    const ip = toIPv4(null, req);
    updateIPReputation(ip, -3);
    shield.incrementBlocked(ip, 'rate_limit');
    res.status(429).json({ error: 'Too many requests, slow down' });
  }
});

app.use('/bare/', apiLimiter);
app.use('/api/', (req, res, next) => {
  if (authPaths.has(req.path)) {
    return authLimiter(req, res, next);
  }
  return apiLimiter(req, res, next);
});

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));

app.use(
  express.json({
    limit: MAX_JSON_SIZE,
    verify: (req, res, buf, encoding) => {
      if (buf && buf.length > MAX_JSON_SIZE) {
        const ip = toIPv4(req.socket.remoteAddress);
        updateIPReputation(ip, -10);
        shield.incrementBlocked(ip, 'json_oversized');
        throw new Error('JSON payload too large');
      }
      const startTime = Date.now();
      try {
        JSON.parse(buf.toString());
      } catch {
        const ip = toIPv4(req.socket.remoteAddress);
        if (Date.now() - startTime > 100) {
          updateIPReputation(ip, -5);
          shield.incrementBlocked(ip, 'json_parse_attack');
        }
      }
    }
  })
);

app.use(express.urlencoded({ extended: true, limit: MAX_JSON_SIZE, parameterLimit: 100 }));

app.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    abortOnLimit: true,
    limitHandler: (req, res) => {
      const ip = toIPv4(req.socket.remoteAddress);
      updateIPReputation(ip, -10);
      shield.incrementBlocked(ip, 'file_oversized');
      res.status(413).json({ error: 'File too large' });
    }
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    name: 'session',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400000
    },
    rolling: true
  })
);

app.use(
  '/api/gn-math/covers',
  createProxyMiddleware({
    target: 'https://cdn.jsdelivr.net/gh/gn-math/covers@main',
    changeOrigin: true,
    pathRewrite: { '^/api/gn-math/covers': '' }
  })
);
app.use(
  '/api/gn-math/html',
  createProxyMiddleware({ target: 'https://cdn.jsdelivr.net/gh/gn-math/html@main', changeOrigin: true, pathRewrite: { '^/api/gn-math/html': '' } })
);

const wsConnections = new Map();
const MAX_WS_PER_IP = 5000;
const MAX_TOTAL_WS = 2000000;

function cleanupWS(ip, req = null) {
  const actualIP = req ? toIPv4(null, req) : ip;
  const count = wsConnections.get(actualIP) || 0;
  if (count <= 1) wsConnections.delete(actualIP);
  else wsConnections.set(actualIP, count - 1);
  systemState.activeConnections--;
  systemState.totalWS--;
  shield.trackWS(actualIP, -1);
}

function cleanupOldEntries() {
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

  if (activeRequests.size > MAX_ACTIVE_REQUESTS) {
    const entries = Array.from(activeRequests.entries());
    entries.sort((a, b) => a[1].startTime - b[1].startTime);
    const toRemove = entries.slice(0, Math.floor(MAX_ACTIVE_REQUESTS * 0.5));
    toRemove.forEach(([key]) => activeRequests.delete(key));
  }

  // Bot cache cleanup removed - bot detection disabled

  if (wsConnections.size > MAX_WS_CONNECTIONS) {
    const entries = Array.from(wsConnections.entries());
    entries.sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, Math.floor(MAX_WS_CONNECTIONS * 0.3));
    toRemove.forEach(([key]) => wsConnections.delete(key));
  }

  for (const [key, value] of requestFingerprints.entries()) {
    if (now - value.lastSeen > 300000) {
      requestFingerprints.delete(key);
    }
  }

  for (const [ip, rep] of ipReputation.entries()) {
    if (now - rep.lastSeen > 3600000) {
      ipReputation.delete(ip);
    }
  }

  for (const [ip, breaker] of circuitBreakers.entries()) {
    if (breaker.open && now > breaker.until) {
      circuitBreakers.delete(ip);
    }
  }

  for (const [reqId, req] of activeRequests.entries()) {
    if (now - req.startTime > REQUEST_TIMEOUT * 2) {
      activeRequests.delete(reqId);
    }
  }
}

setInterval(cleanupOldEntries, 30000);

function checkMemoryPressure() {
  const now = Date.now();
  if (now - memoryPressure.lastCheck < 5000) return memoryPressure.active;
  memoryPressure.lastCheck = now;

  const mem = getMemoryUsage();
  const isHigh = mem.heapUsed > MEMORY_CRITICAL || mem.rss > MEMORY_THRESHOLD;

  if (mem.rss > MEMORY_THRESHOLD * 1.1 && process.uptime() > 1800) {
    shield.sendLog('🚨 High RSS detected, restarting process...', null);
    setTimeout(() => process.exit(0), 5000);
    return true;
  }

  if (isHigh) {
    memoryPressure.consecutiveHigh++;
    if (memoryPressure.consecutiveHigh >= 3) {
      memoryPressure.active = true;
    }
  } else {
    memoryPressure.consecutiveHigh = 0;
    memoryPressure.active = false;
  }

  return memoryPressure.active;
}

app.get('/ip', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/other/roblox/ip.html')));

app.get('/results/:query', async (req, res) => {
  try {
    const query = req.params.query.toLowerCase();
    const response = await fetch(`http://api.duckduckgo.com/ac?q=${encodeURIComponent(query)}&format=json`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    const suggestions = data.map((item) => ({ phrase: item.phrase })).slice(0, 8);
    res.status(200).json(suggestions);
  } catch (error) {
    console.error('Error generating suggestions:', error.message);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

app.use((req, res) => res.status(404).sendFile(join(__dirname, publicPath, '404.html')));

const server = createServer((req, res) => {
  const ip = toIPv4(null, req);
  shield.trackRequest(ip);

  // In dev mode, route Astro-related requests to Astro dev server
  if (isDev && isAstroRunning()) {
    // Check if this is a route that should go to Astro (not proxy routes)
    const isBareRoute = bare.shouldRoute(req) || barePremium.shouldRoute(req);
    const isProxyRoute = req.url.startsWith('/bare/') || req.url.startsWith('/api/bare-premium/') ||
      req.url.startsWith('/wisp/') || req.url.startsWith('/api/wisp-premium/') ||
      req.url.startsWith('/api/alt-wisp-');

    if (!isBareRoute && !isProxyRoute && !req.url.startsWith('/api/')) {
      // Route page requests to Astro
      return handleAstroRequest(req, res);
    }
  }

  const handleBareRequest = (bareServer) => {
    try {
      bareServer.routeRequest(req, res);
    } catch (error) {
      console.error('Bare server error:', error.message);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Internal server error');
    }
  };

  if (bare.shouldRoute(req)) handleBareRequest(bare);
  else if (barePremium.shouldRoute(req)) handleBareRequest(barePremium);
  else app.handle(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url;
  const isBare = bare.shouldRoute(req) || barePremium.shouldRoute(req);
  const isWisp = url.startsWith('/wisp/') || url.startsWith('/api/wisp-premium/') || url.startsWith('/api/alt-wisp-');

  if (!isWisp && !isBare) {
    return socket.destroy();
  }

  const ip = toIPv4(null, req);

  if (checkCircuitBreaker(ip)) {
    shield.incrementBlocked(ip, 'circuit_open');
    return socket.destroy();
  }

  const current = wsConnections.get(ip) || 0;

  if (current > MAX_WS_PER_IP) {
    shield.incrementBlocked(ip, 'ws_cap');
    updateIPReputation(ip, -10);
    return socket.destroy();
  }

  if (systemState.totalWS >= MAX_TOTAL_WS) {
    shield.incrementBlocked(ip, 'ws_limit');
    return socket.destroy();
  }

  wsConnections.set(ip, current + 1);
  systemState.activeConnections++;
  systemState.totalWS++;

  socket.setNoDelay(true);
  socket.setTimeout(0);

  const cleanup = () => {
    const count = wsConnections.get(ip) || 1;
    if (count <= 1) wsConnections.delete(ip);
    else wsConnections.set(ip, count - 1);
    systemState.activeConnections--;
    systemState.totalWS--;
  };

  socket.once('close', cleanup);
  socket.once('error', cleanup);

  if (isBare) {
    try {
      if (bare.shouldRoute(req)) {
        bare.routeUpgrade(req, socket, head);
      } else {
        barePremium.routeUpgrade(req, socket, head);
      }
    } catch (error) {
      console.error('Bare server upgrade error:', error.message);
      socket.destroy();
    }
  } else {
    if (url.startsWith('/api/wisp-premium/')) req.url = '/wisp/' + url.slice(18);
    else if (url.startsWith('/api/alt-wisp-1/')) req.url = '/wisp/' + url.slice(16);
    else if (url.startsWith('/api/alt-wisp-2/')) req.url = '/wisp/' + url.slice(16);
    else if (url.startsWith('/api/alt-wisp-3/')) req.url = '/wisp/' + url.slice(16);
    else if (url.startsWith('/api/alt-wisp-4/')) req.url = '/wisp/' + url.slice(16);
    // this is because in my caddyfile I rewrite these to go to my vpn servers
    // if you are self hosting just ignore this
    try {
      wisp.routeRequest(req, socket, head);
    } catch (error) {
      console.error('WISP server error:', error.message);
      socket.destroy();
    }
  }
});

const port = parseInt(process.env.PORT || '3000');
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
server.requestTimeout = 120000;
server.timeout = 0;
server.maxHeadersCount = 100;
server.maxHeaderSize = MAX_HEADER_SIZE;

const wsFlushSockets = new Set();
let wsFlushPending = false;
let memoryMonitorInterval = null;
let cleanupInterval = null;

function flushWebSockets() {
  if (wsFlushPending || wsFlushSockets.size === 0) return;

  const mem = getMemoryUsage();
  if (mem.heapUsed < MEMORY_CRITICAL * 0.8 && !memoryPressure.active) return;

  wsFlushPending = true;
  shield.sendLog('⚡ WebSocket flush initiated due to memory pressure', null);

  let flushed = 0;
  const maxFlush = Math.floor(systemState.totalWS * 0.3);

  for (const socket of wsFlushSockets) {
    if (flushed >= maxFlush) break;
    try {
      if (socket.readyState === 1) {
        socket.close(1001, 'Memory management');
        flushed++;
      }
    } catch { }
  }

  wsFlushSockets.clear();
  wsFlushPending = false;

  shield.sendLog(`✅ WebSocket flush complete: ${flushed} connections closed`, null);
}

function startMemoryMonitoring() {
  if (memoryMonitorInterval) return;

  memoryMonitorInterval = setInterval(() => {
    const mem = getMemoryUsage();
    checkMemoryPressure();
    checkSystemPressure();

    shield.updateMemoryStats(mem, memoryPressure.active, activeRequests.size);

    const baseline = {
      baselineCpu: baselineMetrics.baselineCpu,
      baselineRequestRate: baselineMetrics.baselineRequestRate,
      baselineBlockRate: baselineMetrics.baselineBlockRate,
      baselineUniqueIps: baselineMetrics.baselineUniqueIps
    };

    shield.checkAttackConditions('system', { ...systemState, ...baseline });

    if (memoryPressure.active && systemState.totalWS > 1000 && systemState.state === 'ATTACK') {
      flushWebSockets();
    }
  }, 5000);
}

function startCleanupInterval() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [key, value] of requestFingerprints.entries()) {
      if (now - value.lastSeen > 300000) requestFingerprints.delete(key);
    }

    for (const [ip, rep] of ipReputation.entries()) {
      if (now - rep.lastSeen > 86400000) {
        ipReputation.delete(ip);
        circuitBreakers.delete(ip);
      }
    }

    for (const [reqId, req] of activeRequests.entries()) {
      if (now - req.startTime > REQUEST_TIMEOUT * 2) {
        activeRequests.delete(reqId);
      }
    }

    if (systemState.trustedClients.size > 10000) {
      systemState.trustedClients.clear();
    }

    for (const [ip, solveTime] of systemState.lastPowSolve.entries()) {
      if (now - solveTime > 86400000) {
        systemState.lastPowSolve.delete(ip);
      }
    }
  }, 60000);
}

if (process.env.NODE_OPTIONS && process.env.NODE_OPTIONS.includes('--expose-gc')) {
  v8.setFlagsFromString('--expose-gc');
}

process.setMaxListeners(0);
process.on('uncaughtException', (err) => {
  shield.sendLog(`💥 Uncaught Exception: ${err.message}`, null);
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  shield.sendLog(`⚠️ Unhandled Rejection: ${reason}`, null);
  console.error('Unhandled Rejection:', reason);
});

// Only minify in production mode
if (!isDev) {
  minifyFiles().catch((err) => console.error('Minification failed:', err));
}

server.listen({ port }, async () => {
  const address = server.address();
  console.log('Server listening on:');
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname()}:${address.port}`);
  console.log(`\thttp://${address.family === 'IPv6' ? `[${address.address}]` : address.address}:${address.port}`);

  // In dev mode, start Astro dev server
  if (isDev) {
    try {
      await startAstroDev({ port: devPort, logLevel: 'info' });
      console.log(`[Server] Astro dev server is running and proxying through http://localhost:${address.port}`);
    } catch (error) {
      console.error('[Server] Failed to start Astro dev server:', error);
      console.log('[Server] Continuing without Astro dev server...');
    }
  }

  startMemoryMonitoring();
  startCleanupInterval();

  // Set up hot reload for development
  if (shouldEnableHotReload()) {
    setupHotReload();
  }
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  console.log('Shutting down...');

  restoreOriginalFiles();

  if (memoryMonitorInterval) clearInterval(memoryMonitorInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);

  for (const socket of wsFlushSockets) {
    try {
      if (socket.readyState === 1) socket.close(1001, 'Server shutdown');
    } catch { }
  }

  if (shield.isUnderAttack) {
    const baseline = {
      baselineCpu: baselineMetrics.baselineCpu,
      baselineRequestRate: baselineMetrics.baselineRequestRate,
      baselineBlockRate: baselineMetrics.baselineBlockRate,
      baselineUniqueIps: baselineMetrics.baselineUniqueIps
    };
    shield.endAttackAlert({ ...systemState, ...baseline });
  }

  // Stop Astro dev server if running
  if (isDev && isAstroRunning()) {
    stopAstroDev()
      .then(() => {
        console.log('[Server] Astro dev server stopped');
        server.close(() => {
          bare.close();
          process.exit(0);
        });
      })
      .catch((err) => {
        console.error('[Server] Error stopping Astro:', err);
        server.close(() => {
          bare.close();
          process.exit(0);
        });
      });
  } else {
    server.close(() => {
      bare.close();
      process.exit(0);
    });
  }

  setTimeout(() => {
    bare.close();
    process.exit(1);
  }, 500);
}
