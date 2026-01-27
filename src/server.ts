import fastifyStatic from '@fastify/static';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
// @ts-expect-error - wisp-js does not have TypeScript declarations
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import scramjetControllerPath from '@petezah-games/scramjet-controller/path';
import bareServerPkg from '@tomphttp/bare-server-node';
import dotenv from 'dotenv';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import fs from 'fs';
import { FASTIFY_ROUTES } from './lib/fastifyRoutes';

const { createBareServer } = bareServerPkg;

// Global types to persist server state
declare global {
  var __FASTIFY_INSTANCE__: FastifyInstance | undefined;
  var __FASTIFY_INIT_PROMISE__: Promise<FastifyInstance> | undefined;
}

// --- LOGGER HELPER ---
function logInfo(message: string) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-GB', { hour12: false }); // 24h format
  const gray = '\x1b[90m';
  const blue = '\x1b[34m';
  const reset = '\x1b[0m';
  // Format: HH:MM:SS [fastify] Message
  console.log(`${gray}${time}${reset} ${blue}[fastify]${reset} ${message}`);
}
// ---------------------

// Initialize environment variables
dotenv.config();
const envFile: string = `.env.${process.env.NODE_ENV || 'production'}`;
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

function toIPv4(ip: string | undefined): string {
  if (!ip) return '127.0.0.1';
  let out: string = ip;
  if (out.includes(',')) out = out.split(',')[0].trim();
  if (out.startsWith('::ffff:')) out = out.replace('::ffff:', '');
  return out.match(/^(\d{1,3}\.){3}\d{1,3}$/) ? out : '127.0.0.1';
}

const wsConnections: Map<string, number> = new Map<string, number>();

function cleanupWS(ip: string): void {
  const count: number = wsConnections.get(ip) || 0;
  if (count <= 1) wsConnections.delete(ip);
  else wsConnections.set(ip, count - 1);
}

/**
 * Core logic to start the server.
 */
async function createServerLogic(): Promise<FastifyInstance> {
  // 1. Force close any existing instance
  if (globalThis.__FASTIFY_INSTANCE__) {
    try {
      await globalThis.__FASTIFY_INSTANCE__.close();
    } catch (e) {
      console.error('Failed to close previous instance:', e);
    }
    globalThis.__FASTIFY_INSTANCE__ = undefined;
  }

  // 2. Initialize new Fastify Instance
  const fastify: FastifyInstance = Fastify({ logger: false });
  globalThis.__FASTIFY_INSTANCE__ = fastify;

  const bare = createBareServer('/bare/', {});
  const barePremium = createBareServer('/api/bare-premium/', {});

  await fastify.register(fastifyStatic, {
    root: scramjetPath,
    prefix: '/scram/'
  });

  await fastify.register(fastifyStatic, {
    root: scramjetControllerPath,
    prefix: '/scramcontroller/',
    decorateReply: false
  });

  fastify.addHook('onRequest', (_request, _reply, done) => {
    done();
  });

  fastify.server.on('upgrade', (req, socket, head) => {
    const url: string = req.url || '';
    const wispPrefixes: string[] = [FASTIFY_ROUTES.wisp, FASTIFY_ROUTES.wispPremium, FASTIFY_ROUTES.altWisp];
    const isOurWs: boolean =
      url.startsWith(FASTIFY_ROUTES.bare) || url.startsWith(FASTIFY_ROUTES.barePremium) || wispPrefixes.some((p) => url.startsWith(p));

    if (!isOurWs) return;

    const ip: string = toIPv4(req.socket.remoteAddress || undefined);
    const current: number = wsConnections.get(ip) || 0;
    wsConnections.set(ip, current + 1);

    socket.on('close', () => cleanupWS(ip));
    socket.on('error', () => cleanupWS(ip));

    if (bare.shouldRoute(req)) return bare.routeUpgrade(req, socket, head);
    if (barePremium.shouldRoute(req)) return barePremium.routeUpgrade(req, socket, head);

    if (wispPrefixes.some((p) => url.startsWith(p))) {
      if (req.url?.startsWith(FASTIFY_ROUTES.wispPremium)) req.url = req.url.replace(FASTIFY_ROUTES.wispPremium, FASTIFY_ROUTES.wisp);
      if (req.url?.startsWith(FASTIFY_ROUTES.altWisp)) req.url = req.url.replace(FASTIFY_ROUTES.altWisp, FASTIFY_ROUTES.wisp);
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

  fastify.setNotFoundHandler((_request, reply) => {
    reply.code(404).type('text/plain').send('FASTIFY-404: Handled by Fastify');
  });

  fastify.addHook('onClose', (_instance, done) => {
    try {
      bare.close();
    } catch {}
    if (globalThis.__FASTIFY_INSTANCE__ === _instance) {
      globalThis.__FASTIFY_INSTANCE__ = undefined;
    }
    done();
  });

  fastify.server.keepAliveTimeout = 30000;

  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });

    // --- UPDATED LOGGING ---
    logInfo('Running on :3001');
    logInfo('Server attached');
    // -----------------------
  } catch (err) {
    globalThis.__FASTIFY_INSTANCE__ = undefined;
    throw err;
  }

  return fastify;
}

/**
 * Main Export with Debouncing
 */
export default function startFastifyServer(): Promise<FastifyInstance> {
  if (globalThis.__FASTIFY_INIT_PROMISE__) {
    return globalThis.__FASTIFY_INIT_PROMISE__;
  }

  const promise = createServerLogic();
  globalThis.__FASTIFY_INIT_PROMISE__ = promise;

  promise
    .then(() => {
      setTimeout(() => {
        if (globalThis.__FASTIFY_INIT_PROMISE__ === promise) {
          globalThis.__FASTIFY_INIT_PROMISE__ = undefined;
        }
      }, 2000);
    })
    .catch(() => {
      if (globalThis.__FASTIFY_INIT_PROMISE__ === promise) {
        globalThis.__FASTIFY_INIT_PROMISE__ = undefined;
      }
    });

  return promise;
}
