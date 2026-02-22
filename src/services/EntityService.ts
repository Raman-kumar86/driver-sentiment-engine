import { getRedis } from "../config/redis";
import { EntityType } from "../config";
import { normalizeEntityId } from "../utils/normalizer";

const TREND_MAX = 20;

export interface EntityStats {
  entityType: EntityType;
  entityId: string;
  avg: number;
  count: number;
}

export class EntityService {
  private redis = getRedis();

  private keys(entityType: EntityType, entityId: string) {
    return {
      avg: `avg:${entityType}:${entityId}`,
      count: `count:${entityType}:${entityId}`,
      trend: `trend:${entityType}:${entityId}`,
    };
  }

  async updateStats(
    entityType: EntityType,
    rawEntityId: string,
    newScore: number
  ): Promise<EntityStats> {
    const entityId = normalizeEntityId(rawEntityId);
    const { avg: avgKey, count: countKey, trend: trendKey } = this.keys(entityType, entityId);

    const newCount = await this.redis.incr(countKey);

    const oldAvgStr = await this.redis.get(avgKey);
    const oldAvg = oldAvgStr ? parseFloat(oldAvgStr) : 0;
    const newAvg = oldAvg + (newScore - oldAvg) / newCount;
    const roundedAvg = parseFloat(newAvg.toFixed(4));

    await this.redis.set(avgKey, roundedAvg);
    await this.redis.rpush(trendKey, newScore);
    await this.redis.ltrim(trendKey, -TREND_MAX, -1);

    return { entityType, entityId, avg: roundedAvg, count: newCount };
  }

  async getStats(entityType: EntityType, rawEntityId: string): Promise<EntityStats | null> {
    const entityId = normalizeEntityId(rawEntityId);
    const { avg: avgKey, count: countKey } = this.keys(entityType, entityId);
    const countStr = await this.redis.get(countKey);
    if (!countStr) return null;
    const avgStr = await this.redis.get(avgKey);
    return {
      entityType,
      entityId,
      avg: avgStr ? parseFloat(avgStr) : 0,
      count: parseInt(countStr, 10),
    };
  }

  async getTrend(entityType: EntityType, rawEntityId: string): Promise<number[]> {
    const entityId = normalizeEntityId(rawEntityId);
    const { trend: trendKey } = this.keys(entityType, entityId);
    const raw = await this.redis.lrange(trendKey, 0, -1);
    return raw.map((v) => parseFloat(v));
  }

  /**
   * Find all entity IDs for a given type by scanning count:entityType:* keys.
   * Keys in Redis are already stored under normalized IDs, so no extra normalization needed here.
   */
  async getEntityIdsByType(entityType: EntityType): Promise<string[]> {
    const prefix = `count:${entityType}:`;
    const keys = await this.redis.keys(`${prefix}*`);
    return keys.map((k) => k.slice(prefix.length));
  }

  async getAllEntityIds(): Promise<{ entityType: EntityType; entityId: string }[]> {
    const keys = await this.redis.keys("count:*:*");
    return keys.map((k) => {
      const parts = k.split(":");
      // count:<entityType>:<entityId>  — entityId may contain colons
      const entityType = parts[1] as EntityType;
      const entityId = parts.slice(2).join(":");
      return { entityType, entityId };
    });
  }

  /**
   * Deduplication: returns true if this feedbackId was already processed for this type.
   */
  async isDuplicate(entityType: EntityType, feedbackId: string): Promise<boolean> {
    const setKey = `processed:${entityType}`;
    const result = await this.redis.sadd(setKey, feedbackId);
    return result === 0;
  }
}

