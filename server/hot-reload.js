import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Set up file watching for hot reload during development
 * When watched files change, the process will restart
 * @param {string} projectRoot - The root directory of the project
 * @returns {Object} Watcher control object with stop() method
 */
export function setupHotReload(projectRoot = null) {
    if (!projectRoot) {
        projectRoot = path.dirname(path.dirname(__filename));
    }

    const watchDirs = [
        path.join(projectRoot, 'server'),
        path.join(projectRoot, 'src'),
        path.join(projectRoot, 'astro.config.ts')
    ];

    const ignorePatterns = [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /\.astro/,
        /\.env/,
        /pnpm-lock\.yaml/,
        /package-lock\.json/
    ];

    const watchers = new Map();
    let debounceTimer = null;
    let restartScheduled = false;

    function shouldIgnore(filepath) {
        return ignorePatterns.some((pattern) => pattern.test(filepath));
    }

    function onFileChange(filepath) {
        if (shouldIgnore(filepath)) return;
        if (restartScheduled) return;

        console.log(`[HotReload] File changed: ${filepath}`);

        // Debounce restart to avoid multiple rapid restarts
        restartScheduled = true;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log('[HotReload] Restarting server...');
            process.exit(0); // Exit with code 0 to signal restart
        }, 500);
    }

    function watchDirectory(dir) {
        if (!fs.existsSync(dir)) {
            console.log(`[HotReload] Directory not found: ${dir}`);
            return;
        }

        if (watchers.has(dir)) {
            return; // Already watching
        }

        try {
            const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
                if (filename) {
                    const filepath = path.join(dir, filename);
                    onFileChange(filepath);
                }
            });

            watchers.set(dir, watcher);
            console.log(`[HotReload] Watching directory: ${dir}`);
        } catch (error) {
            console.error(`[HotReload] Error watching ${dir}:`, error.message);
        }
    }

    function startWatching() {
        console.log('[HotReload] Starting file watcher for development...');

        // Watch the config file specifically
        try {
            const configPath = path.join(projectRoot, 'astro.config.ts');
            if (fs.existsSync(configPath)) {
                const configWatcher = fs.watch(configPath, (eventType, filename) => {
                    onFileChange(configPath);
                });
                watchers.set(configPath, configWatcher);
                console.log('[HotReload] Watching Astro config');
            }
        } catch (error) {
            console.error('[HotReload] Error setting up config watch:', error.message);
        }

        // Watch directories
        watchDirs.forEach((dir) => {
            if (fs.existsSync(dir)) {
                watchDirectory(dir);
            }
        });
    }

    function stopWatching() {
        console.log('[HotReload] Stopping file watcher...');
        clearTimeout(debounceTimer);
        for (const [path, watcher] of watchers.entries()) {
            try {
                watcher.close();
                console.log(`[HotReload] Unwatched: ${path}`);
            } catch (error) {
                console.error(`[HotReload] Error unwatching ${path}:`, error.message);
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
 * @returns {boolean} True if hot reload should be enabled
 */
export function shouldEnableHotReload() {
    return process.env.NODE_ENV !== 'production' && process.argv.includes('--dev');
}
