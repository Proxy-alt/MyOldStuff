#!/usr/bin/env node
/**
 * Server startup wrapper with auto-restart capability
 *
 * Usage:
 *   node server-wrapper.js              # Start in production mode
 *   node server-wrapper.js --dev        # Start in development with hot reload
 *   node server-wrapper.js --watch      # Auto-restart on errors
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse arguments
const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const watchMode = args.includes('--watch');
const isDocker = process.env.DOCKER === 'true';

let serverProcess = null;
let isRestarting = false;
const restartDelay = isDev ? 1000 : 5000;

/**
 * Start the server process
 */
function startServer() {
    if (isRestarting) {
        console.log('[Wrapper] Restart already in progress...');
        return;
    }

    console.log(`[Wrapper] Starting server (${isDev ? 'DEV' : 'PROD'} mode)...`);

    const serverArgs = isDev ? ['--dev'] : [];
    const env = { ...process.env };

    serverProcess = spawn('node', ['server.js', ...serverArgs], {
        stdio: 'inherit',
        env,
        cwd: __dirname
    });

    serverProcess.on('exit', (code, signal) => {
        console.log(`[Wrapper] Server exited with code ${code}, signal ${signal}`);

        if (code === 0 && isDev) {
            // Hot reload triggered, restart
            console.log('[Wrapper] Hot reload detected, restarting...');
            isRestarting = true;
            setTimeout(() => {
                isRestarting = false;
                startServer();
            }, restartDelay);
        } else if (code !== 0 && watchMode) {
            // Error occurred, restart if watch mode enabled
            console.log('[Wrapper] Error detected, restarting in watch mode...');
            setTimeout(startServer, restartDelay);
        } else if (code !== 0) {
            // Production error, exit
            console.error('[Wrapper] Server error in production mode, exiting');
            process.exit(code || 1);
        }
    });

    serverProcess.on('error', (err) => {
        console.error('[Wrapper] Failed to start server:', err);
        if (watchMode) {
            console.log('[Wrapper] Retrying in watch mode...');
            setTimeout(startServer, restartDelay);
        } else {
            process.exit(1);
        }
    });
}

/**
 * Graceful shutdown
 */
function shutdown() {
    console.log('[Wrapper] Shutting down gracefully...');

    if (serverProcess && !serverProcess.killed) {
        serverProcess.on('exit', () => {
            console.log('[Wrapper] Server process terminated');
            process.exit(0);
        });

        serverProcess.kill('SIGTERM');

        // Force kill after timeout
        setTimeout(() => {
            if (serverProcess && !serverProcess.killed) {
                console.log('[Wrapper] Force killing server...');
                serverProcess.kill('SIGKILL');
            }
        }, 5000);
    } else {
        process.exit(0);
    }
}

/**
 * Handle process signals
 */
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', () => {
    console.log('[Wrapper] Received SIGHUP, restarting...');
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
    }
});

/**
 * Log startup info
 */
console.log('[Wrapper] PeteZahGames Server Wrapper');
console.log(`[Wrapper] Mode: ${isDev ? 'DEVELOPMENT (--dev)' : 'PRODUCTION'}`);
console.log(`[Wrapper] Watch mode: ${watchMode ? 'ENABLED (--watch)' : 'DISABLED'}`);
console.log(`[Wrapper] Docker: ${isDocker ? 'YES' : 'NO'}`);
console.log('[Wrapper] ---');

// Start the server
startServer();
