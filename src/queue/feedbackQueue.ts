import { Queue } from "bullmq";
import { config, EntityType } from "../config";

export interface FeedbackJobData {
  entityType: EntityType;
  entityId: string;
  feedbackId: string; // tripId equivalent — used for dedup
  comment: string;
  timestamp: number;
}

let feedbackQueue: Queue<FeedbackJobData> | null = null;

export function getFeedbackQueue(): Queue<FeedbackJobData> {
  if (!feedbackQueue) {
    feedbackQueue = new Queue<FeedbackJobData>(config.queue.name, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return feedbackQueue!;
}
