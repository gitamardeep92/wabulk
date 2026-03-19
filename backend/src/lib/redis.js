import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Upstash drops idle connections aggressively.
// These settings make ioredis reconnect reliably.
const redisConfig = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    // Reconnect after min(times * 200ms, 5s)
    const delay = Math.min(times * 200, 5000);
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  reconnectOnError(err) {
    // Reconnect on ECONNRESET and ETIMEDOUT
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true;
    return false;
  },
  // Keep connection alive with pings
  keepAlive: 10000,
  // Upstash TLS required for rediss:// URLs
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  lazyConnect: false,
};

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisConfig);

redis.on('error', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return; // suppress noise
  console.error('[Redis] Error:', err.message);
});
redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

export default redis;

// BullMQ needs a separate connection instance
// (BullMQ requires dedicated connections — cannot share with app)
export function createRedisConnection() {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    ...redisConfig,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
