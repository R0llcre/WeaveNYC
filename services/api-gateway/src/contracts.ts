const authUserSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_id", "level"],
  properties: {
    user_id: { type: "string", format: "uuid" },
    level: { type: "string", enum: ["anonymous", "verified", "anchor"] }
  }
} as const;

export const anonymousAuthRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["device_id"],
  properties: {
    device_id: {
      type: "string",
      format: "uuid"
    }
  }
} as const;

export const authSessionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["access_token", "refresh_token", "user"],
  properties: {
    access_token: { type: "string" },
    refresh_token: { type: "string" },
    issued_via: {
      type: "string",
      enum: ["anonymous", "otp", "magic_link", "refresh"]
    },
    fallback: { type: "boolean" },
    user: authUserSchema
  }
} as const;

export const anonymousAuthResponseSchema = authSessionResponseSchema;

export const refreshSessionRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["refresh_token"],
  properties: {
    refresh_token: { type: "string" }
  }
} as const;

export const otpStartRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["phone"],
  properties: {
    phone: { type: "string", minLength: 7, maxLength: 32 }
  }
} as const;

export const otpStartResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "challenge_id",
    "masked_destination",
    "delivery_channel",
    "expires_in_seconds",
    "fallback"
  ],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    masked_destination: { type: "string" },
    delivery_channel: { type: "string", enum: ["sms"] },
    expires_in_seconds: { type: "number" },
    fallback: { type: "boolean" },
    demo_code: { type: "string" }
  }
} as const;

export const otpVerifyRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["challenge_id", "code"],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    code: { type: "string", minLength: 6, maxLength: 6 }
  }
} as const;

export const magicLinkStartRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["email"],
  properties: {
    email: { type: "string", format: "email" }
  }
} as const;

export const magicLinkStartResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "challenge_id",
    "masked_destination",
    "delivery_channel",
    "expires_in_seconds",
    "fallback"
  ],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    masked_destination: { type: "string" },
    delivery_channel: { type: "string", enum: ["email"] },
    expires_in_seconds: { type: "number" },
    fallback: { type: "boolean" },
    demo_token: { type: "string" },
    demo_url: { type: "string", format: "uri" }
  }
} as const;

export const magicLinkVerifyRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["challenge_id", "token"],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    token: { type: "string" }
  }
} as const;

export const meResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user"],
  properties: {
    user: {
      type: "object",
      additionalProperties: false,
      required: ["user_id", "level", "role", "community_ids"],
      properties: {
        user_id: { type: "string", format: "uuid" },
        level: { type: "string", enum: ["anonymous", "verified", "anchor"] },
        role: { type: "string", enum: ["user", "anchor"] },
        community_ids: {
          type: "array",
          items: { type: "string", format: "uuid" }
        }
      }
    }
  }
} as const;

export const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: {
    message: { type: "string" }
  }
} as const;

export const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "service", "timestamp"],
  properties: {
    status: { type: "string", enum: ["ok"] },
    service: { type: "string" },
    timestamp: { type: "string", format: "date-time" }
  }
} as const;

export const readinessDependencySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "status"],
  properties: {
    name: { type: "string", enum: ["postgres", "redis"] },
    status: { type: "string", enum: ["ok", "degraded", "unavailable"] },
    latency_ms: { type: "number" },
    detail: { type: "string" }
  }
} as const;

export const readyzResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "service", "timestamp", "checks"],
  properties: {
    status: { type: "string", enum: ["ok", "degraded", "unavailable"] },
    service: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    checks: {
      type: "array",
      items: readinessDependencySchema
    }
  }
} as const;

export const resourcesQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["zip"],
  properties: {
    zip: { type: "string", pattern: "^\\d{5}$" },
    open_now: { type: "boolean" },
    today: { type: "boolean" },
    type: {
      type: "string",
      enum: ["pantry", "kitchen", "market", "benefits", "other"]
    },
    limit: { type: "number", minimum: 1, maximum: 50 },
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" }
  }
} as const;

export const resourceDetailQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    zip: { type: "string", pattern: "^\\d{5}$" }
  }
} as const;

export const resourceSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "provider_id",
    "name",
    "type",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "languages",
    "source",
    "source_label",
    "notes",
    "distance_miles",
    "is_open_today",
    "is_open_now",
    "geo_precision",
    "directions_url"
  ],
  properties: {
    provider_id: { type: "string", format: "uuid" },
    name: { type: "string" },
    type: { type: "string", enum: ["pantry", "kitchen", "market", "benefits", "other"] },
    address: { type: "string" },
    city: { type: ["string", "null"] },
    state: { type: ["string", "null"] },
    zip: { type: "string", pattern: "^\\d{5}$" },
    phone: { type: ["string", "null"] },
    languages: { type: "array", items: { type: "string" } },
    source: { type: "string" },
    source_label: { type: ["string", "null"] },
    source_dataset_version: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    distance_miles: { type: ["number", "null"] },
    is_open_today: { type: "boolean" },
    is_open_now: { type: "boolean" },
    geo_precision: {
      type: "string",
      enum: ["exact", "rooftop", "street", "zip_centroid", "unknown"]
    },
    directions_url: { type: "string", format: "uri" }
  }
} as const;

export const resourceDetailSchema = {
  ...resourceSummarySchema,
  required: [...resourceSummarySchema.required, "weekly_hours", "source_url", "requested_provider_id"],
  properties: {
    ...resourceSummarySchema.properties,
    weekly_hours: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "opens_at", "closes_at", "closed"],
        properties: {
          day: { type: "string" },
          opens_at: { type: ["string", "null"] },
          closes_at: { type: ["string", "null"] },
          closed: { type: "boolean" }
        }
      }
    },
    source_url: { type: ["string", "null"], format: "uri" },
    requested_provider_id: { type: ["string", "null"], format: "uuid" }
  }
} as const;

export const resourceListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "next_cursor", "source_mode"],
  properties: {
    items: {
      type: "array",
      items: resourceSummarySchema
    },
    next_cursor: { type: ["string", "null"] },
    source_mode: { type: "string", enum: ["api", "fixture"] }
  }
} as const;
