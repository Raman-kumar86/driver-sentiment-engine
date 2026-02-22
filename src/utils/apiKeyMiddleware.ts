import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-api-key"] as string | undefined;
  if (!key || key !== config.apiKey) {
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }
  next();
}
