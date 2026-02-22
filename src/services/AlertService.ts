import { getRedis } from "../config/redis";
import { config } from "../config";
import { EntityType } from "../config";

export class AlertService {
  private redis = getRedis();

  async checkAndAlert(
    entityType: EntityType,
    entityId: string,
    avg: number,
    count: number
  ): Promise<void> {
    const { threshold, minReviews, cooldownTtl } = config.alert;

    if (avg >= threshold) return;
    if (count < minReviews) return;

    const cooldownKey = `alert_cooldown:${entityType}:${entityId}`;
    const hasCooldown = await this.redis.exists(cooldownKey);
    if (hasCooldown) return;

    console.warn(
      `[ALERT] ${entityType.toUpperCase()} "${entityId}" has low sentiment ` +
      `avg=${avg.toFixed(2)} (threshold=${threshold}, reviews=${count})`
    );

    await this.redis.set(cooldownKey, "1", "EX", cooldownTtl);
  }
}
