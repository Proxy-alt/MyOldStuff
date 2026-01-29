import dotenv from 'dotenv';
import type { RedisOptions } from 'ioredis';
import Redis from 'ioredis';

dotenv.config();

// --- Types & Interfaces ---

interface BanData {
  open: boolean;
  until: number;
  reason: string;
  bannedBy: string;
}

interface BanPayload {
  ip: string;
  reason: string;
  duration: number;
  server: string;
}

interface AttackPayload {
  server: string;
  metrics: {
    topAbusers?: Array<{ ip: string }>;
  };
}

interface CircuitBreakerEntry {
  open: boolean;
  until: number;
  violations: number;
}

// These interfaces define the shape of objects passed into setupClusterListeners/publishHeartbeat
// You may need to adjust these to match your actual classes for Shield and SystemState
export interface IShield {
  getCpuUsage: () => number;
  isUnderAttack: boolean;
}

export interface ISystemState {
  currentPowDifficulty: number;
  state: string;
  activeConnections: number;
}

export type CircuitBreakerMap = Map<string, CircuitBreakerEntry>;

// --- Redis Configuration ---

const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  enableOfflineQueue: false
};

const redis = new Redis(redisOptions);
const redisSub = redis.duplicate();

redis.on('connect', () => console.log(`[Redis] Connected to ${process.env.REDIS_HOST || '127.0.0.1'}`));
redis.on('error', (err: Error) => console.error('[Redis] Error:', err.message));

const SERVER_ID: string = process.env.SERVER_ID || 'main';

// --- Core Functions ---

async function banIPCluster(ip: string, reason: string, duration: number = 3600): Promise<void> {
  const banData: BanData = {
    open: true,
    until: Date.now() + duration * 1000,
    reason,
    bannedBy: SERVER_ID
  };

  await redis.setex(`ban:${ip}`, duration, JSON.stringify(banData));

  const payload: BanPayload = { ip, reason, duration, server: SERVER_ID };
  await redis.publish('cluster:ban', JSON.stringify(payload));
}

async function checkClusterBan(ip: string): Promise<boolean> {
  const ban = await redis.get(`ban:${ip}`);
  if (!ban) return false;

  try {
    const data = JSON.parse(ban) as BanData;
    return Date.now() < data.until;
  } catch (e) {
    return false;
  }
}

async function updateIPReputationRedis(ip: string, score: number): Promise<number> {
  const key = `rep:${ip}`;
  const newScore = await redis.hincrby(key, 'score', score);

  await redis.hset(key, 'lastSeen', Date.now());
  await redis.expire(key, 86400);

  if (newScore < -150) {
    await banIPCluster(ip, 'reputation_threshold', 7200);
  }

  return newScore;
}

async function checkClusterRateLimit(ip: string, limit: number = 200, window: number = 60): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const current = await redis.incr(key);

  if (current === 1) await redis.expire(key, window);

  return current <= limit;
}

function setupClusterListeners(shield: IShield, systemState: ISystemState, circuitBreakers: CircuitBreakerMap): void {
  redisSub.on('ready', () => {
    redisSub.subscribe('cluster:ban', 'cluster:attack', (err) => {
      if (err) {
        console.error('[Redis] Subscribe failed:', err.message);
      } else {
        console.log('[CLUSTER] Subscribed to cluster channels');
      }
    });
  });

  redisSub.on('message', (channel: string, message: string) => {
    try {
      if (channel === 'cluster:ban') {
        const data = JSON.parse(message) as BanPayload;
        circuitBreakers.set(data.ip, {
          open: true,
          until: Date.now() + data.duration * 1000,
          violations: 100
        });
        console.log(`[CLUSTER] Banned ${data.ip}: ${data.reason}`);
      }

      if (channel === 'cluster:attack') {
        const data = JSON.parse(message) as AttackPayload;
        console.log(`[CLUSTER] ${data.server} under attack!`);

        systemState.currentPowDifficulty = 22;
        systemState.state = 'ATTACK';

        if (data.metrics && Array.isArray(data.metrics.topAbusers)) {
          for (const abuser of data.metrics.topAbusers) {
            banIPCluster(abuser.ip, 'coordinated_attack', 7200);
          }
        }
      }
    } catch (err) {
      console.error('[CLUSTER] Failed to process message', err);
    }
  });
}

async function publishHeartbeat(shield: IShield, systemState: ISystemState): Promise<void> {
  const health = {
    serverId: SERVER_ID,
    timestamp: Date.now(),
    cpu: shield.getCpuUsage(),
    memory: process.memoryUsage().heapUsed / 1024 / 1024 / 1024,
    activeConnections: systemState.activeConnections,
    state: systemState.state,
    isUnderAttack: shield.isUnderAttack
  };

  await redis.setex(`health:${SERVER_ID}`, 30, JSON.stringify(health));
}

export { banIPCluster, checkClusterBan, checkClusterRateLimit, publishHeartbeat, redis, setupClusterListeners, updateIPReputationRedis };
