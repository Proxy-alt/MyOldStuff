import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  enableOfflineQueue: false
});

const redisSub = redis.duplicate();

redis.on('connect', () => console.log(`[Redis] Connected to ${process.env.REDIS_HOST || '127.0.0.1'}`));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

const SERVER_ID = process.env.SERVER_ID || 'main';

async function banIPCluster(ip, reason, duration = 3600) {
  await redis.setex(`ban:${ip}`, duration, JSON.stringify({
    open: true,
    until: Date.now() + (duration * 1000),
    reason,
    bannedBy: SERVER_ID
  }));
  await redis.publish('cluster:ban', JSON.stringify({ ip, reason, duration, server: SERVER_ID }));
}

async function checkClusterBan(ip) {
  const ban = await redis.get(`ban:${ip}`);
  if (!ban) return false;
  const data = JSON.parse(ban);
  return Date.now() < data.until;
}

async function updateIPReputationRedis(ip, score) {
  const key = `rep:${ip}`;
  const newScore = await redis.hincrby(key, 'score', score);
  await redis.hset(key, 'lastSeen', Date.now());
  await redis.expire(key, 86400);
  
  if (newScore < -150) {
    await banIPCluster(ip, 'reputation_threshold', 7200);
  }
  
  return newScore;
}

async function checkClusterRateLimit(ip, limit = 200, window = 60) {
  const key = `ratelimit:${ip}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, window);
  return current <= limit;
}

function setupClusterListeners(shield, systemState, circuitBreakers) {
  redisSub.on('ready', () => {
    redisSub.subscribe('cluster:ban', 'cluster:attack', (err) => {
      if (err) {
        console.error('[Redis] Subscribe failed:', err.message);
      } else {
        console.log('[CLUSTER] Subscribed to cluster channels');
      }
    });
  });
  
  redisSub.on('message', (channel, message) => {
    const data = JSON.parse(message);
    
    if (channel === 'cluster:ban') {
      circuitBreakers.set(data.ip, {
        open: true,
        until: Date.now() + (data.duration * 1000),
        violations: 100
      });
      console.log(`[CLUSTER] Banned ${data.ip}: ${data.reason}`);
    }
    
    if (channel === 'cluster:attack') {
      console.log(`[CLUSTER] ${data.server} under attack!`);
      systemState.currentPowDifficulty = 22;
      systemState.state = 'ATTACK';
      
      for (const abuser of data.metrics.topAbusers || []) {
        banIPCluster(abuser.ip, 'coordinated_attack', 7200);
      }
    }
  });
}

async function publishHeartbeat(shield, systemState) {
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

export { 
  redis, 
  banIPCluster, 
  checkClusterBan, 
  updateIPReputationRedis, 
  checkClusterRateLimit,
  setupClusterListeners,
  publishHeartbeat
};
