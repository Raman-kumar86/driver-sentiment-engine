import { EntityService, EntityStats } from "./EntityService";
import { EntityType, ALL_ENTITY_TYPES } from "../config";

export interface Distribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface OverviewStats {
  totalEntities: number;
  totalFeedback: number;
  distribution: Distribution;
  byType: Record<EntityType, { count: number; avgScore: number }>;
  topEntities: EntityStats[];
}

function scoreLabel(avg: number): "positive" | "neutral" | "negative" {
  if (avg >= 3.5) return "positive";
  if (avg <= 2.5) return "negative";
  return "neutral";
}

export class AnalyticsService {
  private entityService = new EntityService();

  async getAllEntities(filterType?: EntityType): Promise<EntityStats[]> {
    const all = await this.entityService.getAllEntityIds();
    const filtered = filterType ? all.filter((e) => e.entityType === filterType) : all;

    const stats = await Promise.all(
      filtered.map(({ entityType, entityId }) =>
        this.entityService.getStats(entityType, entityId)
      )
    );

    return (stats.filter(Boolean) as EntityStats[]).sort((a, b) => b.avg - a.avg);
  }

  async getOverview(): Promise<OverviewStats> {
    const all = await this.getAllEntities();

    const totalFeedback = all.reduce((sum, e) => sum + e.count, 0);
    const distribution: Distribution = { positive: 0, neutral: 0, negative: 0 };

    const byType = Object.fromEntries(
      ALL_ENTITY_TYPES.map((t) => [t, { count: 0, avgScore: 0 }])
    ) as Record<EntityType, { count: number; avgScore: number }>;

    all.forEach((e) => {
      distribution[scoreLabel(e.avg)]++;
      byType[e.entityType].count += e.count;
      byType[e.entityType].avgScore += e.avg;
    });

    // Average the avgScore per type
    ALL_ENTITY_TYPES.forEach((t) => {
      const entities = all.filter((e) => e.entityType === t);
      if (entities.length > 0) {
        byType[t].avgScore = parseFloat(
          (entities.reduce((s, e) => s + e.avg, 0) / entities.length).toFixed(2)
        );
      }
    });

    return {
      totalEntities: all.length,
      totalFeedback,
      distribution,
      byType,
      topEntities: all.slice(0, 10),
    };
  }
}
