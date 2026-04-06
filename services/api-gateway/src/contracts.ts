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
        required: ["day", "windows", "closed"],
        properties: {
          day: { type: "string" },
          windows: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["opens_at", "closes_at"],
              properties: {
                opens_at: { type: "string" },
                closes_at: { type: "string" }
              }
            }
          },
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

export const communitySummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id", "name", "center_zip", "join_policy"],
  properties: {
    community_id: { type: "string", format: "uuid" },
    name: { type: "string" },
    center_zip: { type: "string", pattern: "^\\d{5}$" },
    join_policy: { type: "string", enum: ["invite_only", "open"] }
  }
} as const;

export const communityAccessResolveRequestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    invite_code: { type: "string", minLength: 1 },
    qr_token: { type: "string", minLength: 1 }
  },
  anyOf: [{ required: ["invite_code"] }, { required: ["qr_token"] }]
} as const;

export const communityAccessResolveResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["community", "join_token", "entry", "expires_in_seconds"],
  properties: {
    community: communitySummarySchema,
    join_token: { type: "string" },
    entry: { type: "string", enum: ["invite_code", "qr_token"] },
    expires_in_seconds: { type: "number" }
  }
} as const;

export const joinCommunityRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["join_token"],
  properties: {
    join_token: { type: "string" }
  }
} as const;

export const joinCommunityResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id", "membership_status", "joined_at"],
  properties: {
    community_id: { type: "string", format: "uuid" },
    membership_status: { type: "string", enum: ["joined", "already_joined"] },
    joined_at: { type: "string", format: "date-time" }
  }
} as const;

export const contactPreferenceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    in_app_chat: { type: "boolean" },
    call: { type: "boolean" },
    text: { type: "boolean" },
    notes: { type: "string", maxLength: 280 }
  }
} as const;

export const createPostRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "community_id",
    "post_type",
    "category",
    "title",
    "body",
    "language",
    "location_zip",
    "privacy",
    "expires_at"
  ],
  properties: {
    community_id: { type: "string", format: "uuid" },
    post_type: { type: "string", enum: ["request", "offer"] },
    category: {
      type: "string",
      enum: ["food", "goods", "childcare", "companionship", "translation", "transportation", "other"]
    },
    title: { type: "string", minLength: 1, maxLength: 60 },
    body: { type: "string", minLength: 1, maxLength: 3000 },
    language: { type: "string", enum: ["en", "es", "zh"] },
    location_zip: { type: "string", pattern: "^\\d{5}$" },
    privacy: { type: "string", enum: ["community_only", "public", "anchor_mediated"] },
    expires_at: { type: "string", format: "date-time" },
    contact_pref: contactPreferenceSchema
  }
} as const;

export const updatePostRequestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: {
      type: "string",
      enum: ["food", "goods", "childcare", "companionship", "translation", "transportation", "other"]
    },
    title: { type: "string", minLength: 1, maxLength: 60 },
    body: { type: "string", minLength: 1, maxLength: 3000 },
    language: { type: "string", enum: ["en", "es", "zh"] },
    location_zip: { type: "string", pattern: "^\\d{5}$" },
    privacy: { type: "string", enum: ["community_only", "public", "anchor_mediated"] },
    expires_at: { type: "string", format: "date-time" },
    contact_pref: contactPreferenceSchema
  }
} as const;

export const createPostResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["post_id", "status", "risk_level"],
  properties: {
    post_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["draft", "pending_review", "active", "fulfilled", "closed", "removed"] },
    risk_level: { type: "string", enum: ["low", "medium", "high"] }
  }
} as const;

export const postSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "post_id",
    "community_id",
    "post_type",
    "category",
    "title",
    "body",
    "language",
    "location_zip",
    "privacy",
    "status",
    "risk_level",
    "created_at",
    "updated_at",
    "expires_at",
    "is_owner"
  ],
  properties: {
    post_id: { type: "string", format: "uuid" },
    community_id: { type: "string", format: "uuid" },
    post_type: { type: "string", enum: ["request", "offer"] },
    category: {
      type: "string",
      enum: ["food", "goods", "childcare", "companionship", "translation", "transportation", "other"]
    },
    title: { type: "string" },
    body: { type: "string" },
    language: { type: "string", enum: ["en", "es", "zh"] },
    location_zip: { type: "string", pattern: "^\\d{5}$" },
    privacy: { type: "string", enum: ["community_only", "public", "anchor_mediated"] },
    status: { type: "string", enum: ["draft", "pending_review", "active", "fulfilled", "closed", "removed"] },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    expires_at: { type: "string", format: "date-time" },
    is_owner: { type: "boolean" }
  }
} as const;

export const postDetailSchema = {
  ...postSummarySchema,
  required: [...postSummarySchema.required, "contact_pref", "actions"],
  properties: {
    ...postSummarySchema.properties,
    contact_pref: { anyOf: [contactPreferenceSchema, { type: "null" }] },
    actions: {
      type: "object",
      additionalProperties: false,
      required: ["can_edit", "can_close", "can_delete", "can_review"],
      properties: {
        can_edit: { type: "boolean" },
        can_close: { type: "boolean" },
        can_delete: { type: "boolean" },
        can_review: { type: "boolean" }
      }
    }
  }
} as const;

export const postParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["post_id"],
  properties: {
    post_id: { type: "string", format: "uuid" }
  }
} as const;

export const postsQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["scope"],
  properties: {
    scope: { type: "string", enum: ["community", "public"] },
    community_id: { type: "string", format: "uuid" },
    post_type: { type: "string", enum: ["request", "offer"] },
    category: {
      type: "string",
      enum: ["food", "goods", "childcare", "companionship", "translation", "transportation", "other"]
    },
    status: { type: "string", enum: ["draft", "pending_review", "active", "fulfilled", "closed", "removed"] },
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
    limit: { type: "number", minimum: 1, maximum: 50 }
  }
} as const;

export const myPostsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    community_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["draft", "pending_review", "active", "fulfilled", "closed", "removed"] },
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
    limit: { type: "number", minimum: 1, maximum: 50 }
  }
} as const;

export const postsListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "next_cursor"],
  properties: {
    items: {
      type: "array",
      items: postSummarySchema
    },
    next_cursor: { type: ["string", "null"] }
  }
} as const;

export const reviewQueueQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id"],
  properties: {
    community_id: { type: "string", format: "uuid" },
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
    limit: { type: "number", minimum: 1, maximum: 50 }
  }
} as const;

export const reviewQueueItemSchema = {
  ...postSummarySchema,
  required: [...postSummarySchema.required, "review_actions"],
  properties: {
    ...postSummarySchema.properties,
    review_actions: {
      type: "array",
      items: { type: "string", enum: ["approve", "reject", "request_more_info"] }
    }
  }
} as const;

export const reviewQueueListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "next_cursor"],
  properties: {
    items: { type: "array", items: reviewQueueItemSchema },
    next_cursor: { type: ["string", "null"] }
  }
} as const;

export const reviewDecisionRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decision"],
  properties: {
    decision: { type: "string", enum: ["approve", "reject", "request_more_info"] },
    notes: { type: "string", minLength: 1, maxLength: 500 }
  }
} as const;

export const reviewDecisionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["post_id", "status", "decided_at"],
  properties: {
    post_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["draft", "pending_review", "active", "fulfilled", "closed", "removed"] },
    decided_at: { type: "string", format: "date-time" }
  }
} as const;

export const speechTranscribeRequestMetaSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    audio: { type: "string", format: "binary" },
    language: { type: "string", enum: ["en", "es", "zh"] },
    transcript_hint: { type: "string" }
  }
} as const;

export const speechTranscribeResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["transcript", "language", "provider"],
  properties: {
    transcript: { type: "string" },
    language: { type: "string", enum: ["en", "es", "zh"] },
    provider: { type: "string", enum: ["browser", "server_fallback"] }
  }
} as const;
