import dotenv from 'dotenv';
import fs from 'fs';

// Load environment
dotenv.config();
const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

export const isDev = process.argv.includes('--dev');
export const astroDevPort = 3001;
export const serverPort = parseInt(process.env.PORT || '3000');

export const config = {
  nodeEnv: process.env.NODE_ENV || 'production',
  isDev,
  serverPort,
  astroDevPort,

  // Thresholds
  maxRequestSize: 10 * 1024 * 1024,
  maxJsonSize: 5 * 1024 * 1024,
  maxHeaderSize: 16384,
  memoryThreshold: 1024 * 1024 * 1024 * 2,
  memoryCritical: 1024 * 1024 * 1024 * 1.5,
  requestTimeout: 60000,
  payloadTimeout: 30000,
  cpuThreshold: 75,

  // Cache sizes
  maxFingerprints: 10000,
  maxIpReputation: 5000,
  maxCircuitBreakers: 1000,
  maxActiveRequests: 5000,
  maxBotCache: 1000,
  maxWsConnections: 5000,

  // Timeouts
  alertCooldown: 600000,
  attackEndTimeout: 300000,
  verificationCacheTtl: 3600000
};

export function logConfig(): void {
  console.log(`[Config] Node Environment: ${config.nodeEnv}`);
  console.log(`[Config] Dev Mode: ${config.isDev}`);
  console.log(`[Config] Server Port: ${config.serverPort}`);
  if (config.isDev) {
    console.log(`[Config] Astro Dev Port: ${config.astroDevPort}`);
  }
}
