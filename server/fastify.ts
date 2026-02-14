import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Fastify from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isDev } from './config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerInstance {
  fastify: FastifyInstance;
  httpServer?: any;
  bareServers?: { regular: any; premium: any };
}

export async function initializeServer(): Promise<ServerInstance> {
  // Create Fastify instance
  const fastify = Fastify({
    logger: isDev ? true : false,
    bodyLimit: config.maxRequestSize
  });

  // Add security headers
  await fastify.register(async (fastify) => {
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-XSS-Protection', '1; mode=block');
    });
  });

  return {
    fastify
  };
}

export async function startServer(instance: ServerInstance): Promise<void> {
  const { fastify } = instance;

  try {
    await fastify.listen({ port: config.serverPort, host: '0.0.0.0' });
    console.log(`[Server] Fastify listening on port ${config.serverPort}`);
  } catch (err) {
    console.error('Failed to start Fastify server:', err);
    process.exit(1);
  }
}

export async function stopServer(instance: ServerInstance): Promise<void> {
  try {
    await instance.fastify.close();
    console.log('[Server] Fastify server closed');
  } catch (err) {
    console.error('Error stopping server:', err);
  }
}
