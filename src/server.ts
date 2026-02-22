import { createApp } from "./app";
import { config } from "./config";
import { getRedis } from "./config/redis";
import { getFeedbackQueue } from "./queue/feedbackQueue";

// Inline worker for dev — in production run `npm run worker` separately
import "./queue/worker";

async function bootstrap(): Promise<void> {
  const redis = getRedis();
  await redis.ping();
  console.log("[Server] Redis ping OK");

  getFeedbackQueue();
  console.log("[Server] BullMQ queue initialized");

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[Server] Feedback Sentiment Platform running on http://localhost:${config.port}`);
    console.log(`[Server] Employee Form:  http://localhost:${config.port}/index.html`);
    console.log(`[Server] Admin Dashboard: http://localhost:${config.port}/dashboard.html`);
    console.log(`[Server] API Key: ${config.apiKey}`);
    console.log(`[Server] Enabled entity types: ${Object.entries(config.featureFlags).filter(([,v])=>v).map(([k])=>k).join(", ")}`);
  });
}

bootstrap().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
