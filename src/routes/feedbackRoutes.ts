import { Router } from "express";
import { FeedbackController } from "../controllers/feedbackController";
import { apiKeyMiddleware } from "../utils/apiKeyMiddleware";

const router = Router();
const controller = new FeedbackController();

// Public endpoint — returns enabled feature flags for the UI
router.get("/config/features", (req, res) => controller.getFeatureFlags(req, res));

// Protected — submit feedback
router.post("/feedback", apiKeyMiddleware, (req, res) => controller.submit(req, res));

export default router;
