import { dev } from 'astro';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

interface AstroDevServer {
  address: { port: number; host: string; family: string; address: string };
  handle: (req: any, res: any) => void;
  watcher: any;
  stop: () => Promise<void>;
}

let astroDevServer: AstroDevServer | null = null;

interface StartAstroDevOptions {
  port?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

/**
 * Start the Astro development server programmatically
 */
export async function startAstroDev(options: StartAstroDevOptions = {}): Promise<AstroDevServer> {
  const { port = 3001, logLevel = 'info' } = options;

  try {
    console.log('[Astro] Starting Astro dev server on port', port);

    astroDevServer = (await dev({
      root: projectRoot,
      logLevel,
      server: {
        port,
        host: 'localhost'
      }
    })) as AstroDevServer;

    console.log(`[Astro] Dev server started at http://localhost:${port}`);
    return astroDevServer;
  } catch (error) {
    console.error('[Astro] Failed to start dev server:', error);
    throw error;
  }
}

/**
 * Stop the Astro development server
 */
export async function stopAstroDev(): Promise<void> {
  if (!astroDevServer) {
    console.warn('[Astro] No dev server running');
    return;
  }

  try {
    console.log('[Astro] Stopping Astro dev server');
    await astroDevServer.stop();
    astroDevServer = null;
    console.log('[Astro] Dev server stopped');
  } catch (error) {
    console.error('[Astro] Error stopping dev server:', error);
  }
}

/**
 * Get the current Astro dev server instance
 */
export function getAstroDev(): AstroDevServer | null {
  return astroDevServer;
}

/**
 * Handle HTTP requests through the Astro dev server
 */
export function handleAstroRequest(req: any, res: any): void {
  if (!astroDevServer) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Astro dev server is not running');
    return;
  }

  try {
    astroDevServer.handle(req, res);
  } catch (error) {
    console.error('[Astro] Error handling request:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }
}

/**
 * Check if Astro dev server is running
 */
export function isAstroRunning(): boolean {
  return astroDevServer !== null;
}
