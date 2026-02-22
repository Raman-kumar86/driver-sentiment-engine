import { Request, Response } from "express";
import { AnalyticsService } from "../services/AnalyticsService";
import { EntityService } from "../services/EntityService";
import { EntityType, ALL_ENTITY_TYPES } from "../config";
import { normalizeEntityId } from "../utils/normalizer";

const analyticsService = new AnalyticsService();
const entityService = new EntityService();

export class AdminController {
  async getAllEntities(req: Request, res: Response): Promise<void> {
    const type = req.query.type as EntityType | undefined;

    if (type && !ALL_ENTITY_TYPES.includes(type)) {
      res.status(400).json({ error: `Invalid entity type: ${type}` });
      return;
    }

    const entities = await analyticsService.getAllEntities(type);
    res.json({ entities, count: entities.length, filter: type || "all" });
  }

  async getOverview(req: Request, res: Response): Promise<void> {
    const overview = await analyticsService.getOverview();
    res.json(overview);
  }

  async getEntityTrend(req: Request, res: Response): Promise<void> {
    const { type } = req.params;
    // Normalize the route param so lookups match the canonical Redis keys
    const entityId = normalizeEntityId(req.params.id);

    if (!ALL_ENTITY_TYPES.includes(type as EntityType)) {
      res.status(400).json({ error: `Invalid entity type: ${type}` });
      return;
    }

    const entityType = type as EntityType;
    const stats = await entityService.getStats(entityType, entityId);

    if (!stats) {
      res.status(404).json({ error: `Entity ${type}:${entityId} not found` });
      return;
    }

    const trend = await entityService.getTrend(entityType, entityId);
    res.json({ entityType, entityId, stats, trend });
  }
}

