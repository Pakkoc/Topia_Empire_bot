import Redis from 'ioredis';

let redisClient: Redis | null = null;
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export function createRedisClient(config: RedisConfig): Redis {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  return redisClient;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call createRedisClient() first.');
  }
  return redisClient;
}

export function createRedisPubSub(config: RedisConfig): { pub: Redis; sub: Redis } {
  if (redisPub && redisSub) {
    return { pub: redisPub, sub: redisSub };
  }

  redisPub = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
  });

  redisSub = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
  });

  return { pub: redisPub, sub: redisSub };
}

export async function closeRedis(): Promise<void> {
  const clients = [redisClient, redisPub, redisSub].filter(Boolean) as Redis[];
  await Promise.all(clients.map(c => c.quit()));
  redisClient = null;
  redisPub = null;
  redisSub = null;
}
