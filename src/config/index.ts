import dotenv from "dotenv";
dotenv.config();

export type EntityType = "driver" | "trip" | "app" | "marshal";
export const ALL_ENTITY_TYPES: EntityType[] = ["driver", "trip", "app", "marshal"];

function parseBool(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined) return fallback;
  return val.toLowerCase() !== "false";
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },

  apiKey: process.env.API_KEY || "supersecretapikey123",

  alert: {
    threshold: parseFloat(process.env.ALERT_THRESHOLD || "2.5"),
    minReviews: parseInt(process.env.ALERT_MIN_REVIEWS || "3", 10),
    cooldownTtl: parseInt(process.env.ALERT_COOLDOWN_TTL || "3600", 10),
  },

  featureFlags: {
    driver: parseBool(process.env.FEATURE_DRIVER, true),
    trip: parseBool(process.env.FEATURE_TRIP, true),
    app: parseBool(process.env.FEATURE_APP, true),
    marshal: parseBool(process.env.FEATURE_MARSHAL, true),
  } as Record<EntityType, boolean>,

  queue: {
    name: "feedback-queue",
  },
};

export function getEnabledEntityTypes(): EntityType[] {
  return ALL_ENTITY_TYPES.filter((t) => config.featureFlags[t]);
}

export function isEntityTypeEnabled(type: string): type is EntityType {
  if (!ALL_ENTITY_TYPES.includes(type as EntityType)) return false;
  return config.featureFlags[type as EntityType] === true;
}
