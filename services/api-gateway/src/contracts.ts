const authUserSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_id", "level"],
  properties: {
    user_id: { type: "string", format: "uuid" },
    level: { type: "string", enum: ["anonymous", "verified", "anchor"] },
    role: { type: "string", enum: ["user", "anchor"] },
    community_ids: {
      type: "array",
      items: { type: "string", format: "uuid" }
    },
    anchor_community_id: { type: "string", format: "uuid" },
    mfa_verified_at: { type: "string", format: "date-time" }
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
      enum: ["anonymous", "otp", "magic_link", "refresh", "anchor_activate", "anchor_session"]
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

export const anchorActivateRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["invite_code"],
  properties: {
    invite_code: { type: "string", minLength: 6, maxLength: 120 }
  }
} as const;

export const anchorActivateResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["activation_id", "community", "otpauth_uri", "recovery_codes", "expires_in_seconds"],
  properties: {
    activation_id: { type: "string", format: "uuid" },
    community: {
      type: "object",
      additionalProperties: false,
      required: ["community_id", "name", "center_zip", "join_policy"],
      properties: {
        community_id: { type: "string", format: "uuid" },
        name: { type: "string" },
        center_zip: { type: "string" },
        join_policy: { type: "string", enum: ["invite_only", "open"] }
      }
    },
    otpauth_uri: { type: "string", format: "uri" },
    recovery_codes: {
      type: "array",
      items: { type: "string" },
      minItems: 8,
      maxItems: 8
    },
    expires_in_seconds: { type: "number" }
  }
} as const;

export const anchorActivateConfirmRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["activation_id", "totp_code"],
  properties: {
    activation_id: { type: "string", format: "uuid" },
    totp_code: { type: "string", minLength: 6, maxLength: 6 }
  }
} as const;

export const anchorSessionStartRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id"],
  properties: {
    community_id: { type: "string", format: "uuid" }
  }
} as const;

export const anchorSessionStartResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["challenge_id", "expires_in_seconds"],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    expires_in_seconds: { type: "number" }
  }
} as const;

export const anchorSessionVerifyRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["challenge_id", "totp_code"],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    totp_code: { type: "string", minLength: 6, maxLength: 6 }
  }
} as const;

export const anchorSessionRecoveryRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id", "recovery_code"],
  properties: {
    community_id: { type: "string", format: "uuid" },
    recovery_code: { type: "string", minLength: 6, maxLength: 64 }
  }
} as const;

export const anchorSessionRecoveryResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["access_token", "refresh_token", "user", "remaining_attempts"],
  properties: {
    access_token: { type: "string" },
    refresh_token: { type: "string" },
    issued_via: {
      type: "string",
      enum: ["anonymous", "otp", "magic_link", "refresh", "anchor_activate", "anchor_session"]
    },
    fallback: { type: "boolean" },
    user: authUserSchema,
    remaining_attempts: { type: "integer", minimum: 0 }
  }
} as const;

export const anchorSessionRecoveryErrorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: {
    message: { type: "string" },
    remaining_attempts: { type: "integer", minimum: 0 }
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
        },
        anchor_community_id: { type: "string", format: "uuid" },
        mfa_verified_at: { type: "string", format: "date-time" }
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

export const accountDeleteReasonEnum = [
  "no_longer_needed",
  "privacy_concerns",
  "moving_away",
  "safety_concerns",
  "other"
] as const;

export const accountDeleteRequestRequestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {}
} as const;

export const accountDeleteRequestResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "challenge_id",
    "masked_destination",
    "delivery_channel",
    "expires_in_seconds"
  ],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    masked_destination: { type: "string" },
    delivery_channel: { type: "string", enum: ["sms", "email"] },
    expires_in_seconds: { type: "integer", minimum: 1 },
    fallback: { type: "boolean" },
    demo_code: { type: "string" },
    demo_token: { type: "string" },
    demo_url: { type: "string", format: "uri" }
  }
} as const;

export const accountDeleteConfirmRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["challenge_id", "code"],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    code: { type: "string", minLength: 1, maxLength: 128 },
    reason: {
      type: "string",
      enum: [...accountDeleteReasonEnum]
    }
  }
} as const;

export const accountDeleteConfirmResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "purge_date", "user_id"],
  properties: {
    status: { type: "string", enum: ["deletion_scheduled"] },
    purge_date: { type: "string", format: "date-time" },
    user_id: { type: "string", format: "uuid" }
  }
} as const;

export const accountUndeleteRequestRequestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {}
} as const;

export const accountUndeleteRequestResponseSchema = accountDeleteRequestResponseSchema;

export const accountUndeleteConfirmRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["challenge_id", "code"],
  properties: {
    challenge_id: { type: "string", format: "uuid" },
    code: { type: "string", minLength: 1, maxLength: 128 }
  }
} as const;

export const accountUndeleteConfirmResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "user_id"],
  properties: {
    status: { type: "string", enum: ["restored"] },
    user_id: { type: "string", format: "uuid" }
  }
} as const;

/**
 * @deprecated superseded by the 3-step flow.
 */
export const accountDeleteRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["confirmation"],
  properties: {
    confirmation: { type: "string", enum: ["DELETE_MY_ACCOUNT"] },
    reason: {
      type: "string",
      enum: [...accountDeleteReasonEnum]
    }
  }
} as const;

/**
 * @deprecated superseded by the 3-step flow.
 */
export const accountDeleteResponseSchema = accountDeleteConfirmResponseSchema;

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

export const versionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["service", "version", "runtime", "timestamp"],
  properties: {
    service: { type: "string" },
    version: { type: "string" },
    runtime: { type: "string" },
    timestamp: { type: "string", format: "date-time" }
  }
} as const;

export const metricsResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["service", "version", "uptime_seconds", "node_env", "timestamp"],
  properties: {
    service: { type: "string" },
    version: { type: "string" },
    uptime_seconds: { type: "number" },
    node_env: { type: "string" },
    timestamp: { type: "string", format: "date-time" }
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

export const communityBootstrapParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id"],
  properties: {
    community_id: { type: "string", format: "uuid" },
  },
} as const;

export const communitySyncQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    since: { type: "string", format: "date-time" },
    limit: { type: "integer", minimum: 1, maximum: 200 },
  },
} as const;

export const p2pTopicMapSchema = {
  type: "object",
  additionalProperties: false,
  required: ["posts", "announcements", "reports"],
  properties: {
    posts: { type: "string" },
    announcements: { type: "string" },
    reports: { type: "string" },
  },
} as const;

export const p2pSnapshotSchema = {
  type: "object",
  additionalProperties: false,
  // `event_count` is populated on bootstrap but OMITTED from the /sync hot
  // path when derivable from the delta (P4 finding 3 / B). Keeping it
  // optional on the wire lets the server skip a count(*) scan per request.
  required: ["last_event_at"],
  properties: {
    last_event_at: { type: ["string", "null"], format: "date-time" },
    event_count: { type: "integer", minimum: 0 },
  },
} as const;

export const p2pNodeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["node_id", "websocket_url"],
  properties: {
    node_id: { type: "string" },
    websocket_url: { type: "string", format: "uri" },
  },
} as const;

const postSyncEventPayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: ["post"],
  properties: {
    post: {
      type: "object",
      additionalProperties: true,
      required: ["post_id"],
      properties: {
        post_id: { type: "string", format: "uuid" },
      },
    },
    reason: { type: ["string", "null"] },
  },
} as const;

const announcementSyncEventPayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: ["announcement"],
  properties: {
    announcement: {
      type: "object",
      additionalProperties: true,
      required: ["announcement_id"],
      properties: {
        announcement_id: { type: "string", format: "uuid" },
      },
    },
  },
} as const;

const reportCreatedEventPayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: ["report_id", "target_type", "target_id", "reason", "status", "created_at"],
  properties: {
    report_id: { type: "string", format: "uuid" },
    target_type: { type: "string", enum: ["post"] },
    target_id: { type: "string", format: "uuid" },
    reason: { type: "string" },
    status: { type: "string", enum: ["new", "resolved", "dismissed"] },
    created_at: { type: "string", format: "date-time" },
  },
} as const;

const moderationDecisionEventPayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "report_id",
    "target_type",
    "target_id",
    "report_target_type",
    "report_target_id",
    "resolution",
    "status",
    "decided_at",
  ],
  properties: {
    report_id: { type: ["string", "null"], format: "uuid" },
    target_type: { type: "string", enum: ["post"] },
    target_id: { type: "string", format: "uuid" },
    report_target_type: { type: "string", enum: ["post"] },
    report_target_id: { type: "string", format: "uuid" },
    resolution: { type: "string" },
    status: { type: "string" },
    decided_at: { type: "string", format: "date-time" },
  },
} as const;

const p2pEventBaseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "sync_event_id",
    "community_id",
    "topic",
    "event_type",
    "aggregate_type",
    "aggregate_id",
    "occurred_at",
    "payload",
  ],
  properties: {
    sync_event_id: { type: "string", format: "uuid" },
    community_id: { type: "string", format: "uuid" },
    topic: { type: "string" },
    event_type: { type: "string" },
    aggregate_type: { type: "string" },
    aggregate_id: { type: "string", format: "uuid" },
    occurred_at: { type: "string", format: "date-time" },
    cid: { type: ["string", "null"] },
    signature: { type: ["string", "null"] },
    actor_p2p_id: { type: ["string", "null"] },
    payload: { type: "object" },
  },
} as const;

export const p2pEventSchema = {
  oneOf: [
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["post.published"] },
        aggregate_type: { type: "string", enum: ["post"] },
        payload: postSyncEventPayloadSchema,
      },
    },
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["post.updated"] },
        aggregate_type: { type: "string", enum: ["post"] },
        payload: postSyncEventPayloadSchema,
      },
    },
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["post.tombstoned"] },
        aggregate_type: { type: "string", enum: ["post"] },
        payload: postSyncEventPayloadSchema,
      },
    },
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["announcement.published"] },
        aggregate_type: { type: "string", enum: ["announcement"] },
        payload: announcementSyncEventPayloadSchema,
      },
    },
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["announcement.updated"] },
        aggregate_type: { type: "string", enum: ["announcement"] },
        payload: announcementSyncEventPayloadSchema,
      },
    },
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["announcement.deleted"] },
        aggregate_type: { type: "string", enum: ["announcement"] },
        payload: announcementSyncEventPayloadSchema,
      },
    },
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["report.created"] },
        aggregate_type: { type: "string", enum: ["report"] },
        payload: reportCreatedEventPayloadSchema,
      },
    },
    {
      ...p2pEventBaseSchema,
      properties: {
        ...p2pEventBaseSchema.properties,
        event_type: { type: "string", enum: ["moderation.decision"] },
        aggregate_type: { type: "string", enum: ["moderation"] },
        payload: moderationDecisionEventPayloadSchema,
      },
    },
  ],
} as const;

export const communityBootstrapResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "community_id",
    "protocol_version",
    "bootstrap_version",
    "anchor_node",
    "relay_nodes",
    "topics",
    "latest_snapshot",
    "mdns_demo_enabled",
  ],
  properties: {
    community_id: { type: "string", format: "uuid" },
    // Wire-format tag. See `P2P_OVERLAY_PROTOCOL_VERSION` in
    // packages/shared/src/validators/p2p.ts — client compares on receipt
    // and halts the loop on mismatch (P1 finding 4).
    protocol_version: { type: "string", enum: ["m6-overlay-v1"] },
    bootstrap_version: { type: "string" },
    anchor_node: p2pNodeSchema,
    relay_nodes: {
      type: "array",
      items: p2pNodeSchema,
    },
    topics: p2pTopicMapSchema,
    latest_snapshot: p2pSnapshotSchema,
    mdns_demo_enabled: { type: "boolean" },
  },
} as const;

export const communitySyncDeltaResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "protocol_version",
    "events",
    "next_since",
    "server_time",
    "latest_snapshot",
    "has_more",
  ],
  properties: {
    protocol_version: { type: "string", enum: ["m6-overlay-v1"] },
    events: {
      type: "array",
      items: p2pEventSchema,
    },
    next_since: { type: ["string", "null"] },
    server_time: { type: "string", format: "date-time" },
    latest_snapshot: p2pSnapshotSchema,
    // Explicit end-of-stream signal for the client's catch-up loop.
    // Server computes `events.length === limit` — the client loops until
    // this is false (P1 finding 6 / P2 finding 2).
    has_more: { type: "boolean" },
  },
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
  minProperties: 1,
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

export const matchResultsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    refresh: { type: "boolean" }
  }
} as const;

export const matchSuggestionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "suggestion_id",
    "batch_number",
    "position",
    "candidate_type",
    "candidate_id",
    "score",
    "reasons",
    "distance_miles",
    "neighbor_post",
    "official_resource"
  ],
  properties: {
    suggestion_id: { type: "string", format: "uuid" },
    batch_number: { type: "integer", minimum: 1 },
    position: { type: "integer", minimum: 1, maximum: 3 },
    candidate_type: { type: "string", enum: ["neighbor_post", "official_resource"] },
    candidate_id: { type: "string", format: "uuid" },
    score: { type: "number" },
    reasons: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "same_category",
          "same_language",
          "within_1_mile",
          "within_3_miles",
          "within_5_miles",
          "verified_user",
          "anchor_reviewed",
          "expires_soon",
          "open_now",
          "open_today",
          "nearby_resource",
          "language_supported"
        ]
      }
    },
    distance_miles: { type: ["number", "null"] },
    neighbor_post: { anyOf: [postSummarySchema, { type: "null" }] },
    official_resource: { anyOf: [resourceSummarySchema, { type: "null" }] }
  }
} as const;

export const matchResultsResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "post_id",
    "batch_number",
    "advanced",
    "refreshes_used",
    "max_refreshes",
    "items"
  ],
  properties: {
    post_id: { type: "string", format: "uuid" },
    batch_number: { type: "integer", minimum: 1 },
    advanced: { type: "boolean" },
    refreshes_used: { type: "integer", minimum: 0, maximum: 1 },
    max_refreshes: { type: "integer", minimum: 1, maximum: 1 },
    items: {
      type: "array",
      items: matchSuggestionSchema,
      maxItems: 3
    }
  }
} as const;

export const matchContactRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["from_post_id", "to_post_id"],
  properties: {
    from_post_id: { type: "string", format: "uuid" },
    to_post_id: { type: "string", format: "uuid" }
  }
} as const;

export const matchContactResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contact_request_id", "status"],
  properties: {
    contact_request_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["pending", "accepted"] },
    conversation_id: { type: "string", format: "uuid" }
  }
} as const;

export const contactRequestInboxQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
    limit: { type: "number", minimum: 1, maximum: 50 }
  }
} as const;

export const contactRequestParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contact_request_id"],
  properties: {
    contact_request_id: { type: "string", format: "uuid" }
  }
} as const;

export const contactRequestInboxItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "contact_request_id",
    "from_post_id",
    "to_post_id",
    "requester_user_id",
    "requester_alias",
    "status",
    "created_at",
    "expires_at",
    "from_post_title",
    "to_post_title",
    "from_post_category",
    "to_post_category"
  ],
  properties: {
    contact_request_id: { type: "string", format: "uuid" },
    from_post_id: { type: "string", format: "uuid" },
    to_post_id: { type: "string", format: "uuid" },
    requester_user_id: { type: "string", format: "uuid" },
    requester_alias: { type: "string" },
    status: { type: "string", enum: ["pending", "accepted", "rejected", "expired", "cancelled"] },
    created_at: { type: "string", format: "date-time" },
    expires_at: { type: "string", format: "date-time" },
    from_post_title: { type: "string" },
    to_post_title: { type: "string" },
    from_post_category: {
      type: "string",
      enum: ["food", "goods", "childcare", "companionship", "translation", "transportation", "other"]
    },
    to_post_category: {
      type: "string",
      enum: ["food", "goods", "childcare", "companionship", "translation", "transportation", "other"]
    }
  }
} as const;

export const contactRequestInboxResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "next_cursor"],
  properties: {
    items: {
      type: "array",
      items: contactRequestInboxItemSchema
    },
    next_cursor: { type: ["string", "null"] }
  }
} as const;

export const contactRequestDecisionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contact_request_id", "status", "responded_at"],
  properties: {
    contact_request_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["accepted", "rejected"] },
    responded_at: { type: "string", format: "date-time" },
    conversation_id: { type: "string", format: "uuid" }
  }
} as const;

export const conversationParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversation_id"],
  properties: {
    conversation_id: { type: "string", format: "uuid" }
  }
} as const;

export const conversationParticipantPreviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_id", "alias"],
  properties: {
    user_id: { type: "string", format: "uuid" },
    alias: { type: "string" }
  }
} as const;

export const conversationSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "conversation_id",
    "contact_request_id",
    "related_post_ids",
    "participant_preview",
    "status",
    "created_at",
    "last_activity_at",
    "last_message_preview",
    "unread_count",
  ],
  properties: {
    conversation_id: { type: "string", format: "uuid" },
    contact_request_id: { type: "string", format: "uuid" },
    related_post_ids: {
      type: "array",
      items: { type: "string", format: "uuid" }
    },
    participant_preview: {
      type: "array",
      items: conversationParticipantPreviewSchema
    },
    status: { type: "string", enum: ["active", "closed", "blocked"] },
    created_at: { type: "string", format: "date-time" },
    last_activity_at: { type: "string", format: "date-time" },
    last_message_preview: { type: ["string", "null"] },
    unread_count: { type: "number", minimum: 0 },
  }
} as const;

export const conversationsListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
    limit: { type: "number", minimum: 1, maximum: 50 },
  }
} as const;

export const conversationsListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "next_cursor"],
  properties: {
    items: {
      type: "array",
      items: conversationSummarySchema,
    },
    next_cursor: { type: ["string", "null"] },
  }
} as const;

export const conversationDetailSchema = {
  type: "object",
  additionalProperties: false,
  required: [...conversationSummarySchema.required, "other_user_id", "actions"],
  properties: {
    ...conversationSummarySchema.properties,
    other_user_id: { type: "string", format: "uuid" },
    actions: {
      type: "object",
      additionalProperties: false,
      required: ["can_send", "can_close", "can_block", "can_report"],
      properties: {
        can_send: { type: "boolean" },
        can_close: { type: "boolean" },
        can_block: { type: "boolean" },
        can_report: { type: "boolean" },
      },
    },
  },
} as const;

export const conversationMessageQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
    limit: { type: "number", minimum: 1, maximum: 50 },
  }
} as const;

export const conversationMessageSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "message_id",
    "conversation_id",
    "sender_user_id",
    "sender_alias",
    "body",
    "sent_at",
    "is_mine",
    "safety_flags",
  ],
  properties: {
    message_id: { type: "string", format: "uuid" },
    conversation_id: { type: "string", format: "uuid" },
    sender_user_id: { type: "string", format: "uuid" },
    sender_alias: { type: "string" },
    body: { type: "string" },
    sent_at: { type: "string", format: "date-time" },
    is_mine: { type: "boolean" },
    safety_flags: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "sensitive_ssn",
          "sensitive_phone",
          "sensitive_address",
          "sensitive_bank_account",
          "keyword_passport",
          "keyword_bank",
          "keyword_wire",
          "keyword_crypto",
          "keyword_gift_card",
        ],
      },
    },
  },
} as const;

export const conversationMessagesResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "next_cursor"],
  properties: {
    items: {
      type: "array",
      items: conversationMessageSchema,
    },
    next_cursor: { type: ["string", "null"] },
  },
} as const;

export const sendConversationMessageRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["body"],
  properties: {
    body: { type: "string", minLength: 1, maxLength: 2000 },
    // Optional client-side dedup key. Mirrors the Zod validator in
    // packages/shared/src/validators/chat.ts `sendConversationMessageRequestSchema`.
    client_message_id: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

export const sendConversationMessageResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversation_id", "message"],
  properties: {
    conversation_id: { type: "string", format: "uuid" },
    message: conversationMessageSchema,
  },
} as const;

export const closeConversationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversation_id", "status", "closed_at"],
  properties: {
    conversation_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["closed"] },
    closed_at: { type: "string", format: "date-time" },
  },
} as const;

export const blockUserRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blocked_user_id"],
  properties: {
    blocked_user_id: { type: "string", format: "uuid" },
    conversation_id: { type: "string", format: "uuid" },
  },
} as const;

export const blockUserResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blocked_user_id", "status", "blocked_at", "affected_conversation_ids"],
  properties: {
    blocked_user_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["blocked"] },
    blocked_at: { type: "string", format: "date-time" },
    affected_conversation_ids: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
  },
} as const;

export const reportCreateRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["target_type", "target_id", "reason"],
  properties: {
    target_type: { type: "string", enum: ["post", "user", "message"] },
    target_id: { type: "string", format: "uuid" },
    reason: { type: "string", enum: ["harassment", "scam", "misinformation", "unsafe_behavior", "other"] },
    conversation_id: { type: "string", format: "uuid" },
    evidence_description: { type: "string", minLength: 1, maxLength: 1000 },
  },
} as const;

export const reportCreateResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["report_id", "status", "created_at"],
  properties: {
    report_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["new"] },
    created_at: { type: "string", format: "date-time" },
  },
} as const;

export const communityParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id"],
  properties: {
    community_id: { type: "string", format: "uuid" },
  },
} as const;

export const announcementParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id", "announcement_id"],
  properties: {
    community_id: { type: "string", format: "uuid" },
    announcement_id: { type: "string", format: "uuid" },
  },
} as const;

export const adminReportQueueQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["community_id"],
  properties: {
    community_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["new", "resolved", "dismissed"] },
    cursor: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
    limit: { type: "number", minimum: 1, maximum: 50 },
  },
} as const;

export const adminReportTargetSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body_preview", "related_user_id"],
  properties: {
    title: { type: "string" },
    body_preview: { type: ["string", "null"] },
    related_user_id: { type: ["string", "null"], format: "uuid" },
  },
} as const;

export const adminReportQueueItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "report_id",
    "community_id",
    "target_type",
    "target_id",
    "reason",
    "status",
    "created_at",
    "reporter_user_id",
    "reporter_alias",
    "priority",
    "conversation_id",
    "target_summary",
    "evidence_description",
  ],
  properties: {
    report_id: { type: "string", format: "uuid" },
    community_id: { type: "string", format: "uuid" },
    target_type: { type: "string", enum: ["post", "user", "message"] },
    target_id: { type: "string", format: "uuid" },
    reason: { type: "string", enum: ["harassment", "scam", "misinformation", "unsafe_behavior", "other"] },
    status: { type: "string", enum: ["new", "resolved", "dismissed"] },
    created_at: { type: "string", format: "date-time" },
    reporter_user_id: { type: "string", format: "uuid" },
    reporter_alias: { type: "string" },
    priority: { type: "string", enum: ["P0", "P1", "P2"] },
    conversation_id: { type: ["string", "null"], format: "uuid" },
    target_summary: adminReportTargetSummarySchema,
    evidence_description: { type: ["string", "null"] },
  },
} as const;

export const adminReportQueueResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "next_cursor"],
  properties: {
    items: {
      type: "array",
      items: adminReportQueueItemSchema,
    },
    next_cursor: { type: ["string", "null"] },
  },
} as const;

export const adminReportDecisionRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decision"],
  properties: {
    decision: { type: "string", enum: ["dismiss", "warn", "remove_post", "suspend_user"] },
    notes: { type: "string", minLength: 1, maxLength: 1000 },
  },
} as const;

export const adminReportDecisionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["report_id", "status", "resolution", "decided_at"],
  properties: {
    report_id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["new", "resolved", "dismissed"] },
    resolution: { type: "string", enum: ["remove_post", "suspend_user", "warn", "none"] },
    decided_at: { type: "string", format: "date-time" },
    affected_user_id: { type: "string", format: "uuid", nullable: true },
  },
} as const;

export const adminAnnouncementsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    include_deleted: { type: "boolean" },
  },
} as const;

export const communityRulesResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "community_id",
    "review_categories",
    "auto_hide_report_threshold",
    "keyword_blocklist",
    "language_preferences",
    "announcement_pin_strategy",
    "updated_at",
  ],
  properties: {
    community_id: { type: "string", format: "uuid" },
    review_categories: {
      type: "array",
      items: {
        type: "string",
        enum: ["food", "goods", "childcare", "companionship", "translation", "transportation", "other"],
      },
    },
    auto_hide_report_threshold: { type: "integer", minimum: 1, maximum: 20 },
    keyword_blocklist: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 120 },
    },
    language_preferences: {
      type: "array",
      items: { type: "string", enum: ["en", "es", "zh"] },
    },
    announcement_pin_strategy: { type: "string", enum: ["latest", "manual"] },
    updated_at: { type: "string", format: "date-time" },
  },
} as const;

export const communityRulesUpdateRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "review_categories",
    "auto_hide_report_threshold",
    "keyword_blocklist",
    "language_preferences",
    "announcement_pin_strategy",
  ],
  properties: {
    review_categories: communityRulesResponseSchema.properties.review_categories,
    auto_hide_report_threshold: communityRulesResponseSchema.properties.auto_hide_report_threshold,
    keyword_blocklist: communityRulesResponseSchema.properties.keyword_blocklist,
    language_preferences: communityRulesResponseSchema.properties.language_preferences,
    announcement_pin_strategy: communityRulesResponseSchema.properties.announcement_pin_strategy,
  },
} as const;

export const announcementSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "announcement_id",
    "community_id",
    "title",
    "body",
    "status",
    "is_pinned",
    "published_at",
    "updated_at",
    "created_by",
  ],
  properties: {
    announcement_id: { type: "string", format: "uuid" },
    community_id: { type: "string", format: "uuid" },
    title: { type: "string", minLength: 1, maxLength: 140 },
    body: { type: "string", minLength: 1, maxLength: 4000 },
    status: { type: "string", enum: ["active", "deleted"] },
    is_pinned: { type: "boolean" },
    published_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    created_by: { type: "string", format: "uuid" },
  },
} as const;

export const announcementCreateRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 140 },
    body: { type: "string", minLength: 1, maxLength: 4000 },
    is_pinned: { type: "boolean" },
  },
} as const;

export const announcementUpdateRequestSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: announcementCreateRequestSchema.properties,
} as const;

export const announcementsResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: announcementSchema,
    },
  },
} as const;

export const adminDashboardResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "community_id",
    "posts_this_week_request_count",
    "posts_this_week_offer_count",
    "accepted_contacts_this_week_count",
    "reports_this_week_count",
    "pending_post_review_count",
    "pending_report_count",
  ],
  properties: {
    community_id: { type: "string", format: "uuid" },
    posts_this_week_request_count: { type: "integer", minimum: 0 },
    posts_this_week_offer_count: { type: "integer", minimum: 0 },
    accepted_contacts_this_week_count: { type: "integer", minimum: 0 },
    reports_this_week_count: { type: "integer", minimum: 0 },
    pending_post_review_count: { type: "integer", minimum: 0 },
    pending_report_count: { type: "integer", minimum: 0 },
  },
} as const;

export const messageSafetyErrorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message", "blocked", "safety_flags"],
  properties: {
    message: { type: "string" },
    blocked: { type: "boolean", enum: [true] },
    safety_flags: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "sensitive_ssn",
          "sensitive_phone",
          "sensitive_address",
          "sensitive_bank_account",
          "keyword_passport",
          "keyword_bank",
          "keyword_wire",
          "keyword_crypto",
          "keyword_gift_card",
        ],
      },
    },
  },
} as const;
