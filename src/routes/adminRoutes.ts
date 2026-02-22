import { Router } from "express";
import { AdminController } from "../controllers/adminController";
import { apiKeyMiddleware } from "../utils/apiKeyMiddleware";

const router = Router();
const controller = new AdminController();

router.use(apiKeyMiddleware);

// GET /admin/entities?type=driver
router.get("/entities", (req, res) => controller.getAllEntities(req, res));

// GET /admin/overview
router.get("/overview", (req, res) => controller.getOverview(req, res));

// GET /admin/entity/:type/:id/trend
router.get("/entity/:type/:id/trend", (req, res) => controller.getEntityTrend(req, res));

export default router;
