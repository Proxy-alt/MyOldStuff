import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WatcherControl {
  stop: () => void;
}

/**
 * Set up file watching for hot reload during development
 */
export function setupHotReload(projectRoot?: string): WatcherControl {
  if (!projectRoot) {
    projectRoot = path.dirname(path.dirname(__filename));
  }

  const watchDirs = [path.join(projectRoot, 'server'), path.join(projectRoot, 'src'), path.join(projectRoot, 'astro.config.ts')];

  const ignorePatterns = [/node_modules/, /\.git/, /dist/, /build/, /\.astro/, /\.env/, /\.src/, /pnpm-lock\.yaml/, /package-lock\.json/];

  const watchers = new Map<string, fs.FSWatcher>();
  let debounceTimer: NodeJS.Timeout | null = null;
  let restartScheduled = false;

  function shouldIgnore(filepath: string): boolean {
    return ignorePatterns.some((pattern) => pattern.test(filepath));
  }

  function onFileChange(filepath: string): void {
    if (shouldIgnore(filepath)) return;
    if (restartScheduled) return;

    console.log(`[HotReload] File changed: ${filepath}`);

    restartScheduled = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log('[HotReload] Restarting server...');
      process.exit(0);
    }, 500);
  }

  function watchDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      console.log(`[HotReload] Directory not found: ${dir}`);
      return;
    }

    if (watchers.has(dir)) {
      return;
    }

    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType: string, filename: string | Buffer | null) => {
        if (filename) {
          const filepath = path.join(dir, filename.toString());
          onFileChange(filepath);
        }
      });

      watchers.set(dir, watcher);
      console.log(`[HotReload] Watching directory: ${dir}`);
    } catch (error) {
      console.error(`[HotReload] Error watching ${dir}:`, (error as Error).message);
    }
  }

  function startWatching(): void {
    console.log('[HotReload] Starting file watcher for development...');

    try {
      const configPath = path.join(projectRoot!, 'astro.config.ts');
      if (fs.existsSync(configPath)) {
        const configWatcher = fs.watch(configPath, (eventType: string) => {
          onFileChange(configPath);
        });
        watchers.set(configPath, configWatcher);
        console.log('[HotReload] Watching Astro config');
      }
    } catch (error) {
      console.error('[HotReload] Error setting up config watch:', (error as Error).message);
    }

    watchDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        watchDirectory(dir);
      }
    });
  }

  function stopWatching(): void {
    console.log('[HotReload] Stopping file watcher...');
    if (debounceTimer) clearTimeout(debounceTimer);
    for (const [dirPath, watcher] of watchers.entries()) {
      try {
        watcher.close();
        console.log(`[HotReload] Unwatched: ${dirPath}`);
      } catch (error) {
        console.error(`[HotReload] Error unwatching ${dirPath}:`, (error as Error).message);
      }
    }
    watchers.clear();
  }

  startWatching();

  return {
    stop: stopWatching
  };
}

/**
 * Check if we should enable hot reload based on environment
 */
export function shouldEnableHotReload(): boolean {
  return process.env.NODE_ENV !== 'production' && process.argv.includes('--dev');
}
