import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import bareServerPkg from '@tomphttp/bare-server-node';
import dotenv from 'dotenv';
import fs from 'fs';
import { Client, GatewayIntentBits } from 'discord.js';
import { ddosShield } from './scripts/secure.js';
import type { FastifyInstance } from 'fastify';

const { createBareServer } = bareServerPkg;

// --- 1. Global/Module Scope Setup ---
// These initialize once when the module is loaded.

dotenv.config();
const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

// Bare & Wisp Setup
const bare = createBareServer('/bare/', {});
const barePremium = createBareServer('/api/bare-premium/', {});

// Discord & Shield Setup
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
const shield = ddosShield(discordClient);

// Only login if we have a token (prevents crashes during build/types check)
if (process.env.BOT_TOKEN) {
  discordClient.login(process.env.BOT_TOKEN).catch((err: any) => {
    console.error('Failed to login Discord bot:', err?.message || err);
  });
}

shield.registerCommands(discordClient);

// Helpers
function toIPv4(ip: string | undefined): string {
  if (!ip) return '127.0.0.1';
  let out = ip;
  if (out.includes(',')) out = out.split(',')[0].trim();
  if (out.startsWith('::ffff:')) out = out.replace('::ffff:', '');
  return out.match(/^(\d{1,3}\.){3}\d{1,3}$/) ? out : '127.0.0.1';
}

// Websocket Tracking
const wsConnections = new Map<string, number>();
const MAX_WS_PER_IP = Number(process.env.MAX_WS_PER_IP || '180');
const MAX_TOTAL_WS = Number(process.env.MAX_TOTAL_WS || '30000');

function cleanupWS(ip: string): void {
  const count = wsConnections.get(ip) || 0;
  if (count <= 1) wsConnections.delete(ip);
  else wsConnections.set(ip, count - 1);
  shield.trackWS(ip, -1);
}

// Rate Limiting
const ENABLE_RATE_LIMITER = process.env.ENABLE_RATE_LIMITER === 'true';
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || '15000');
const RATE_MAX = Number(process.env.RATE_MAX || '100');
type RateEntry = { count: number; reset: number };
const rateMap = new Map<string, RateEntry>();

function isRateLimited(ip: string): boolean {
  if (!ENABLE_RATE_LIMITER) return false;
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > RATE_MAX;
}

function handleUpgradeVerification(_req: any, _ip: string): boolean {
  return true;
}

// --- 2. The Adapter Entry Function ---
// This is what @matthewp/astro-fastify calls.

export default function (fastify: FastifyInstance) {

  // A. Handle HTTP Requests (Bare)
  // We use 'onRequest' hook to intercept before Fastify router.
  fastify.addHook('onRequest', (request, reply, done) => {
    const req = request.raw;
    const res = reply.raw;
    const ip = toIPv4(req.socket.remoteAddress || undefined);
    const url = req.url || '';

    // Only intervene for our specific routes
const isBare =
  url.startsWith('/bare/') ||
  url.startsWith('/api/bare') ||
  url.startsWith('/api/bare-premium/');


    // If we didn't match Bare, call done() to let Astro/Fastify handle it
    done();
  });

  // B. Handle Upgrades (WebSocket / Wisp)
  // Fastify doesn't handle upgrades by default, so we attach to the raw server.
  fastify.server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';

    // SAFETY CHECK: If it's not our path, ignore it.
    // This allows Vite/Astro HMR websockets to work in dev mode.
    const wispPrefixes = ['/wisp/', '/api/wisp-premium/', '/api/alt-wisp-'];
    const isOurWs = url.startsWith('/bare/') ||
                    url.startsWith('/api/bare') ||
                    wispPrefixes.some(p => url.startsWith(p));

    if (!isOurWs) return;

    const ip = toIPv4(req.socket.remoteAddress || undefined);
    const current = wsConnections.get(ip) || 0;
    const total = [...wsConnections.values()].reduce((a, b) => a + b, 0);

    if (total >= MAX_TOTAL_WS || current >= MAX_WS_PER_IP) {
      shield.trackWS(ip, 1);
      socket.destroy();
      return;
    }

    shield.trackWS(ip, 1);

    if (!handleUpgradeVerification(req, ip)) {
      shield.trackWS(ip, -1);
      socket.destroy();
      return;
    }

    wsConnections.set(ip, current + 1);
    socket.on('close', () => cleanupWS(ip));
    socket.on('error', () => cleanupWS(ip));

    // Bare Upgrades
    if (bare.shouldRoute(req)) return bare.routeUpgrade(req, socket, head);
    if (barePremium.shouldRoute(req)) return barePremium.routeUpgrade(req, socket, head);

    // Wisp Upgrades
    if (wispPrefixes.some((p) => url.startsWith(p))) {
      // Rewrite URL logic
      if (req.url?.startsWith('/api/wisp-premium/')) req.url = req.url.replace('/api/wisp-premium/', '/wisp/');
      if (req.url?.startsWith('/api/alt-wisp-1/')) req.url = req.url.replace('/api/alt-wisp-1/', '/wisp/');
      // ... (Add other replacements as needed from original code) ...

      try {
        wisp.routeRequest(req, socket, head);
      } catch (error: any) {
        console.error('WISP server error:', error?.message || error);
        socket.destroy();
        cleanupWS(ip);
      }
      return;
    }

    cleanupWS(ip);
    socket.destroy();
  });

fastify.setNotFoundHandler((request, reply) => {
  reply
    .code(404)
    .type('text/plain')
    .send('FASTIFY-404: This was handled by Fastify, not Astro');
});

  // C. Server Timeouts (Optional, applied to raw server)
  fastify.server.keepAliveTimeout = 30000;
  fastify.server.headersTimeout = 31000;
  fastify.server.requestTimeout = 30000;
  fastify.server.timeout = 30000;

  // D. Graceful Shutdown Hook
  // Fastify has an onClose hook we can use to clean up Bare
  fastify.addHook('onClose', (instance, done) => {
    if (shield.isUnderAttack) shield.endAttackAlert();
    try {
      bare.close();
      // discordClient.destroy(); // Optional
    } catch {}
    done();
  });
};
