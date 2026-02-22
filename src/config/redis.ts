import Redis from "ioredis";
import { config } from "./index";

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: null,
    });

    redisInstance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redisInstance.on("connect", () => {
      console.log(`[Redis] Connected to ${config.redis.host}:${config.redis.port}`);
    });
  }
  return redisInstance;
}

export function createRedisConnection(): Redis {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
  });
}
