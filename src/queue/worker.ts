import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { config } from "../config";
import { FeedbackJobData } from "./feedbackQueue";
import { SentimentService } from "../services/SentimentService";
import { EntityService } from "../services/EntityService";
import { AlertService } from "../services/AlertService";

const sentimentService = new SentimentService();
const entityService = new EntityService();
const alertService = new AlertService();

async function processFeedback(job: Job<FeedbackJobData>): Promise<void> {
  const { entityType, entityId, feedbackId, comment } = job.data;

  console.log(
    `[Worker] Job ${job.id} | type=${entityType} entity=${entityId} feedback=${feedbackId}`
  );

  // Deduplication
  const isDuplicate = await entityService.isDuplicate(entityType, feedbackId);
  if (isDuplicate) {
    console.log(`[Worker] Skipping duplicate feedbackId=${feedbackId}`);
    return;
  }

  // Sentiment analysis
  const sentiment = sentimentService.analyze(comment);
  console.log(
    `[Worker] Sentiment: score=${sentiment.normalizedScore} label=${sentiment.label}`
  );

  // Update entity stats
  const stats = await entityService.updateStats(entityType, entityId, sentiment.normalizedScore);
  console.log(
    `[Worker] Updated ${entityType}:${entityId} → avg=${stats.avg.toFixed(2)} count=${stats.count}`
  );

  // Check alert
  await alertService.checkAndAlert(entityType, entityId, stats.avg, stats.count);
}

const worker = new Worker<FeedbackJobData>(
  config.queue.name,
  processFeedback,
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error("[Worker] Error:", err.message);
});

console.log(`[Worker] Listening on queue: ${config.queue.name}`);
