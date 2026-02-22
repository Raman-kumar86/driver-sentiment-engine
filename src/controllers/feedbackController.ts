import { Request, Response } from "express";
import { getFeedbackQueue } from "../queue/feedbackQueue";
import { isEntityTypeEnabled, config, getEnabledEntityTypes } from "../config";
import { normalizeEntityId } from "../utils/normalizer";

export class FeedbackController {
  async submit(req: Request, res: Response): Promise<void> {
    const { entityType, comment } = req.body;
    // Normalize early so the canonical ID is used everywhere below
    const entityId = normalizeEntityId(String(req.body.entityId ?? ""));

    if (!entityType || !entityId || !comment) {
      res.status(400).json({
        error: "entityType, entityId, and comment are required",
      });
      return;
    }

    if (!isEntityTypeEnabled(entityType)) {
      res.status(403).json({
        error: `Entity type "${entityType}" is disabled or not recognized`,
        enabledTypes: getEnabledEntityTypes(),
      });
      return;
    }

    if (typeof comment !== "string" || comment.trim().length === 0) {
      res.status(400).json({ error: "comment must be a non-empty string" });
      return;
    }

    // Generate a unique feedbackId for dedup (callers may also pass one)
    // Uses the normalized entityId so IDs like "001" and "1" share the same dedup key
    const feedbackId = req.body.feedbackId || `${entityType}-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const queue = getFeedbackQueue();
    const job = await queue.add("process-feedback", {
      entityType,
      entityId: String(entityId),
      feedbackId: String(feedbackId),
      comment: comment.trim(),
      timestamp: Date.now(),
    });

    res.status(200).json({
      status: "queued",
      jobId: job.id,
      feedbackId,
      message: "Feedback received and queued for async processing",
    });
  }

  getFeatureFlags(req: Request, res: Response): void {
    res.json({
      featureFlags: config.featureFlags,
      enabledTypes: getEnabledEntityTypes(),
    });
  }
}
