import express, { Application, Request, Response } from "express";
import path from "path";
import feedbackRoutes from "./routes/feedbackRoutes";
import adminRoutes from "./routes/adminRoutes";

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static files (dashboard, feedback form)
  app.use(express.static(path.join(__dirname, "../public")));

  // API routes
  app.use("/", feedbackRoutes);
  app.use("/admin", adminRoutes);

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
