/**
 * redis.js — Redis client (now optional)
 *
 * We removed BullMQ in favour of a Supabase-based polling worker.
 * Redis is no longer required for core functionality.
 * This file is kept for potential future caching use.
 */

// No-op redis object for backwards compatibility
// Real Redis connection removed to fix Upstash free tier connection limits
const redis = {
  get: async () => null,
  set: async () => null,
  del: async () => null,
  on: () => {},
};

export default redis;

export function createRedisConnection() {
  return redis;
}
