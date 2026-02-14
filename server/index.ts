#!/usr/bin/env node
/**
 * PeteZahGames Server
 * Fastify + Astro Integration
 *
 * Usage:
 *   node server.ts              - Production mode
 *   node server.ts --dev        - Development with Astro dev server & hot reload
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAstroRunning, startAstroDev, stopAstroDev } from './astro-integration.ts';
import { config, isDev, logConfig } from './config.ts';
import { initializeServer, startServer, stopServer } from './fastify.ts';
import { setupHotReload, shouldEnableHotReload } from './hot-reload.ts';
//import { registerApiRoutes } from './routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log startup info
console.log(`[Main] Starting PeteZahGames Server`);
logConfig();

// Initialize and start server
let serverInstance: any = null;
let hotReloadWatcher: any = null;

async function startup() {
  try {
    // Initialize Fastify server
    serverInstance = await initializeServer();

    // Register API routes from server/api/*
    // await registerApiRoutes(serverInstance.fastify);

    // Start Fastify server
    await startServer(serverInstance);

    // Start Astro dev server if in dev mode
    if (isDev) {
      try {
        await startAstroDev({ port: config.astroDevPort, logLevel: 'info' });
        console.log(`[Main] Astro dev server running on port ${config.astroDevPort}`);
      } catch (error) {
        console.error('[Main] Failed to start Astro dev server:', error);
        console.log('[Main] Continuing without Astro dev server...');
      }
    }

    // Setup hot reload if in dev mode
    if (shouldEnableHotReload()) {
      hotReloadWatcher = setupHotReload();
      console.log('[Main] Hot reload watcher initialized');
    }

    console.log('[Main] ✅ Server ready');
  } catch (error) {
    console.error('[Main] Startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[Main] Received ${signal}, shutting down gracefully...`);

  try {
    // Stop hot reload watcher
    if (hotReloadWatcher) {
      hotReloadWatcher.stop();
    }

    // Stop Astro dev server
    if (isDev && isAstroRunning()) {
      await stopAstroDev();
    }

    // Stop Fastify server
    if (serverInstance) {
      await stopServer(serverInstance);
    }

    console.log('[Main] ✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Main] Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the server
startup();
