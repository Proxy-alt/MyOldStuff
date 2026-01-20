import fastifyStatic from '@fastify/static';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import scramjetControllerPath from '@petezah-games/scramjet-controller/path';
import bareServerPkg from '@tomphttp/bare-server-node';
import dotenv from 'dotenv';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import fs from 'fs';

const { createBareServer } = bareServerPkg;

// --- 1. Persist the instance outside the function scope ---
let instance: FastifyInstance | null = null;

// Move dotenv out so it only runs once
dotenv.config();
const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

// Helpers (No changes needed here)
function toIPv4(ip: string | undefined): string {
  if (!ip) return '127.0.0.1';
  let out = ip;
  if (out.includes(',')) out = out.split(',')[0].trim();
  if (out.startsWith('::ffff:')) out = out.replace('::ffff:', '');
  return out.match(/^(\d{1,3}\.){3}\d{1,3}$/) ? out : '127.0.0.1';
}

const wsConnections = new Map<string, number>();
function cleanupWS(ip: string): void {
  const count = wsConnections.get(ip) || 0;
  if (count <= 1) wsConnections.delete(ip);
  else wsConnections.set(ip, count - 1);
}

export default async function startFastifyServer() {
  // --- 2. Check if instance already exists (Guard Clause) ---
  if (instance) {
    return instance;
  }

  // Create the new instance ONLY if one doesn't exist
  const fastify = Fastify({ logger: false });
  instance = fastify;

  const bare = createBareServer('/bare/', {});
  const barePremium = createBareServer('/api/bare-premium/', {});

  // Register Plugins
  await fastify.register(fastifyStatic, {
    root: scramjetPath,
    prefix: '/scram/'
  });

  await fastify.register(fastifyStatic, {
    root: scramjetControllerPath,
    prefix: '/scramcontroller/',
    decorateReply: false
  });

  // Hooks
  fastify.addHook('onRequest', (request, reply, done) => {
    done();
  });

  // WebSocket Upgrades
  fastify.server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    const wispPrefixes = ['/wisp/', '/api/wisp-premium/', '/api/alt-wisp-'];
    const isOurWs = url.startsWith('/bare/') || url.startsWith('/api/bare') || wispPrefixes.some((p) => url.startsWith(p));

    if (!isOurWs) return;

    const ip = toIPv4(req.socket.remoteAddress || undefined);
    const current = wsConnections.get(ip) || 0;
    wsConnections.set(ip, current + 1);

    socket.on('close', () => cleanupWS(ip));
    socket.on('error', () => cleanupWS(ip));

    if (bare.shouldRoute(req)) return bare.routeUpgrade(req, socket, head);
    if (barePremium.shouldRoute(req)) return barePremium.routeUpgrade(req, socket, head);

    if (wispPrefixes.some((p) => url.startsWith(p))) {
      if (req.url?.startsWith('/api/wisp-premium/')) req.url = req.url.replace('/api/wisp-premium/', '/wisp/');
      if (req.url?.startsWith('/api/alt-wisp-1/')) req.url = req.url.replace('/api/alt-wisp-1/', '/wisp/');
      try {
        wisp.routeRequest(req, socket, head);
      } catch (error: any) {
        socket.destroy();
        cleanupWS(ip);
      }
      return;
    }
    cleanupWS(ip);
    socket.destroy();
  });

  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).type('text/plain').send('FASTIFY-404: Handled by Fastify');
  });

  fastify.addHook('onClose', (instance, done) => {
    try {
      bare.close();
    } catch {}
    done();
  });

  fastify.server.keepAliveTimeout = 30000;

  // Listen
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Fastify running on :3001');
  } catch (err) {
    instance = null; // Reset on failure so next attempt can retry
    throw err;
  }

  return fastify;
}
startFastifyServer();
