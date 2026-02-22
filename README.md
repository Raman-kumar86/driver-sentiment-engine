# 🚦 Feedback Sentiment Platform v2

A multi-entity, async feedback sentiment analysis platform built with Node.js, TypeScript, Express, BullMQ, and Redis. Supports feedback for **Drivers**, **Trips**, **Mobile App**, and **Marshals** with a configurable feature flag system.

---

## Architecture

```
                        ┌─────────────────────────────────────┐
                        │           Express HTTP API           │
                        │                                      │
  Employee Form ───────►│  POST /feedback   GET /config/features│
  Admin Dashboard ─────►│  GET  /admin/entities                │
                        │  GET  /admin/overview                │
                        │  GET  /admin/entity/:type/:id/trend  │
                        └────────────┬────────────────────────┘
                                     │
                              Feature flag check
                              API key middleware
                                     │
                                     ▼
                        ┌────────────────────────┐
                        │   BullMQ Queue         │◄── Redis (separate connection)
                        │   "feedback-queue"     │
                        └────────────┬───────────┘
                                     │  async job
                                     ▼
                        ┌────────────────────────┐
                        │      Worker Process     │
                        │                        │
                        │  1. isDuplicate()?     │
                        │  2. SentimentService   │
                        │  3. EntityService      │──► Redis (avg, count, trend)
                        │  4. AlertService       │──► Redis (cooldown TTL key)
                        └────────────────────────┘
                                     │
                              ┌──────▼──────┐
                              │    Redis     │
                              │             │
                              │ avg:T:ID    │ ← Cumulative moving average
                              │ count:T:ID  │ ← Review count
                              │ trend:T:ID  │ ← Last 20 scores (LIST)
                              │ processed:T │ ← Dedup SET per entity type
                              │ alert_cooldown:T:ID ← TTL key
                              └─────────────┘
```

---

## Why Redis?

Redis is used as the **sole state store** for this platform for several reasons:

- **Speed**: All stat updates (avg, count, trend) are O(1) or O(log N) operations in Redis. A traditional DB would require a read-modify-write cycle under a transaction.
- **Native data structures**: `INCR` for atomic counts, `RPUSH`+`LTRIM` for bounded trend lists, `SADD` for dedup sets — these map directly to the problem.
- **TTL-based cooldowns**: Alert cooldown windows are implemented as Redis keys with `EX` TTL. No cron jobs or scheduled cleanup needed.
- **BullMQ backing**: BullMQ itself requires Redis. Using Redis for application state means zero additional infrastructure.

---

## Why BullMQ?

BullMQ decouples the HTTP request lifecycle from the sentiment processing lifecycle:

- **Latency**: The API returns `200 OK` in <5ms. Sentiment analysis, Redis writes, and alert checks happen asynchronously.
- **Reliability**: BullMQ persists jobs in Redis. If the worker crashes mid-job, the job is retried (up to 3 times with exponential backoff) automatically.
- **Backpressure**: The queue absorbs traffic spikes without blocking the HTTP thread.
- **Concurrency control**: The worker runs up to 5 jobs in parallel, tunable without touching the API layer.

---

## Why Async Processing?

Synchronous processing would block the Express event loop during:
1. AFINN lexicon scoring (CPU-bound string parsing)
2. Multiple Redis round-trips (avg read → incr count → set avg → rpush trend → ltrim)
3. Alert condition evaluation

By making feedback processing async, the API can handle thousands of submissions per second while the worker processes them at a sustainable rate.

---

## Feature Flag System

Feature flags control which entity types accept feedback:

```env
FEATURE_DRIVER=true
FEATURE_TRIP=true
FEATURE_APP=false       # Disables app feedback
FEATURE_MARSHAL=true
```

- The API rejects feedback for disabled types with `403 Forbidden`
- `GET /config/features` (public, no auth) returns enabled types so the employee form dynamically populates its dropdown
- No code changes required — flip the env var and restart

---

## Entity Types

| Type | Description | Example ID |
|---|---|---|
| `driver` | Individual driver feedback | `DRV-001` |
| `trip` | Post-trip experience rating | `TRIP-2091` |
| `app` | Mobile app review | `app-android` |
| `marshal` | Event marshal rating | `MSH-007` |

---

## Redis Key Schema

| Key Pattern | Type | Description |
|---|---|---|
| `avg:<type>:<id>` | String | Cumulative moving average (1–5) |
| `count:<type>:<id>` | String | Total feedback received |
| `trend:<type>:<id>` | List | Last 20 normalized scores |
| `processed:<type>` | Set | Feedback IDs already processed (dedup) |
| `alert_cooldown:<type>:<id>` | String (TTL) | Active alert suppression window |

---

## Sentiment Scoring

Uses the **AFINN-165** lexicon via the `sentiment` npm package.

```
Raw comparative score (per-word avg):   [-∞, +∞]
Clamped to:                             [-3, +3]
Mapped linearly to:                     [1, 5]

Formula: normalizedScore = ((clamped + 3) / 6) * 4 + 1
```

| Score Range | Label | Meaning |
|---|---|---|
| ≥ 3.5 | positive | Good experience |
| 2.5 – 3.5 | neutral | Mixed or factual |
| ≤ 2.5 | negative | Poor experience → may trigger alert |

---

## Alert Logic

```
IF avg < ALERT_THRESHOLD (default 2.5)
AND count >= ALERT_MIN_REVIEWS (default 3)
AND NOT EXISTS alert_cooldown:<type>:<id>
THEN
  console.warn([ALERT] ...)
  SET alert_cooldown:<type>:<id> EX 3600
```

The TTL key prevents repeat alerts for the same entity within 1 hour (configurable via `ALERT_COOLDOWN_TTL`).

---

## Cumulative Moving Average

Score history is not stored in full. Instead, a running average is maintained:

```
newAvg = oldAvg + (newScore - oldAvg) / newCount
```

This is O(1) space per entity regardless of review count. The last 20 scores are stored separately in the `trend:<type>:<id>` LIST for the dashboard chart.

---

## Time & Space Complexity

| Operation | Time | Space |
|---|---|---|
| POST /feedback (enqueue) | O(1) | O(1) |
| Sentiment analysis | O(n) — n = word count | O(1) |
| Dedup check (SADD) | O(1) | O(total feedback per type) |
| Update avg (INCR + GET + SET) | O(1) | O(1) per entity |
| Update trend (RPUSH + LTRIM) | O(1) amortized | O(20) per entity |
| Alert check (EXISTS + SET) | O(1) | O(1) TTL key per entity |
| GET /admin/entities | O(E) — E = entity count | O(E) |
| GET /admin/overview | O(E) | O(E) |
| GET /admin/entity/:type/:id/trend | O(1) | O(20) |

---

## Quick Start

```bash
# 1. Start Redis
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment (Windows)
copy .env.example .env

# 4. Start (server + inline worker)
npm run dev
```

| URL | Description |
|---|---|
| `http://localhost:3000/` | Employee feedback form |
| `http://localhost:3000/dashboard.html` | Admin dashboard |
| `http://localhost:3000/config/features` | Feature flags (public) |
| `http://localhost:3000/health` | Health check |

---

## API Reference

### POST /feedback
```json
// Request
Headers: { "x-api-key": "supersecretapikey123", "Content-Type": "application/json" }
Body: {
  "entityType": "driver" | "trip" | "app" | "marshal",
  "entityId": "DRV-001",
  "comment": "Excellent service, arrived on time!"
}

// Response 200
{ "status": "queued", "jobId": "1", "feedbackId": "driver-DRV-001-...", "message": "..." }

// Response 403 (disabled type)
{ "error": "Entity type \"app\" is disabled", "enabledTypes": ["driver","trip","marshal"] }
```

### GET /admin/entities?type=driver
```json
{ "entities": [ { "entityType": "driver", "entityId": "DRV-001", "avg": 3.84, "count": 12 } ], "count": 1 }
```

### GET /admin/overview
```json
{
  "totalEntities": 24,
  "totalFeedback": 312,
  "distribution": { "positive": 18, "neutral": 4, "negative": 2 },
  "byType": {
    "driver":  { "count": 180, "avgScore": 3.91 },
    "trip":    { "count": 92,  "avgScore": 3.44 },
    "app":     { "count": 28,  "avgScore": 2.87 },
    "marshal": { "count": 12,  "avgScore": 4.12 }
  },
  "topEntities": [...]
}
```

### GET /admin/entity/:type/:id/trend
```json
{ "entityType": "driver", "entityId": "DRV-001", "stats": { "avg": 3.84, "count": 12 }, "trend": [4.33, 3.67, 4.0, ...] }
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `API_KEY` | `supersecretapikey123` | Shared API key |
| `ALERT_THRESHOLD` | `2.5` | Avg score below which alert fires |
| `ALERT_MIN_REVIEWS` | `3` | Minimum reviews before alert |
| `ALERT_COOLDOWN_TTL` | `3600` | Alert cooldown in seconds |
| `FEATURE_DRIVER` | `true` | Enable driver feedback |
| `FEATURE_TRIP` | `true` | Enable trip feedback |
| `FEATURE_APP` | `true` | Enable app feedback |
| `FEATURE_MARSHAL` | `true` | Enable marshal feedback |

---

## Trade-offs

| Decision | Trade-off |
|---|---|
| Redis-only state | Fast + simple, but no durability across Redis restarts. Production: replicate to Postgres. |
| Inline worker (dev) | One process is easier to run locally. Production: separate `npm run worker` processes per CPU core. |
| Shared API key | Simple auth. Production: per-client JWT or OAuth 2.0 client credentials. |
| AFINN lexicon | Fast, zero dependencies, no API calls. Misses sarcasm, emojis, multilingual text. Production: fine-tuned transformer. |
| Cumulative Moving Average | O(1) space, no history needed. Loses distribution info (e.g., bimodal scores). Production: store raw scores in a time-series DB. |
| Feature flags via env | Zero UI needed, instant restart flip. Production: use a feature flag service (LaunchDarkly, Unleash) for runtime toggles without restarts. |

---

## Folder Structure

```
driver-sentiment-engine/
├── src/
│   ├── config/
│   │   ├── index.ts         # App config, feature flags, EntityType definition
│   │   └── redis.ts         # Redis singleton + BullMQ connection factory
│   ├── controllers/
│   │   ├── feedbackController.ts
│   │   └── adminController.ts
│   ├── services/
│   │   ├── SentimentService.ts   # AFINN analysis + normalization
│   │   ├── EntityService.ts      # Generic multi-type Redis stats
│   │   ├── AlertService.ts       # Threshold + cooldown logic
│   │   └── AnalyticsService.ts   # Cross-entity aggregation
│   ├── queue/
│   │   ├── feedbackQueue.ts  # BullMQ Queue producer
│   │   └── worker.ts         # BullMQ Worker consumer
│   ├── routes/
│   │   ├── feedbackRoutes.ts
│   │   └── adminRoutes.ts
│   ├── utils/
│   │   └── apiKeyMiddleware.ts
│   ├── app.ts
│   └── server.ts
├── public/
│   ├── index.html        # Employee feedback form
│   └── dashboard.html    # Admin dashboard
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```
