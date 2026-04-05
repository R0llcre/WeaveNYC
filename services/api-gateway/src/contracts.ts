export const anonymousAuthRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['device_id'],
  properties: {
    device_id: {
      type: 'string',
      format: 'uuid'
    }
  }
} as const;

export const authUserSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['user_id', 'level'],
  properties: {
    user_id: { type: 'string', format: 'uuid' },
    level: { type: 'string', enum: ['anonymous', 'verified', 'anchor'] }
  }
} as const;

export const anonymousAuthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['access_token', 'refresh_token', 'user'],
  properties: {
    access_token: { type: 'string' },
    refresh_token: { type: 'string' },
    user: authUserSchema
  }
} as const;

export const meResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['user'],
  properties: {
    user: {
      type: 'object',
      additionalProperties: false,
      required: ['user_id', 'level', 'role', 'community_ids'],
      properties: {
        user_id: { type: 'string', format: 'uuid' },
        level: { type: 'string', enum: ['anonymous', 'verified', 'anchor'] },
        role: { type: 'string', enum: ['user', 'anchor'] },
        community_ids: {
          type: 'array',
          items: { type: 'string', format: 'uuid' }
        }
      }
    }
  }
} as const;

export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: {
    message: { type: 'string' }
  }
} as const;

export const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'timestamp'],
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    service: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    checks: {
      type: 'object',
      additionalProperties: false,
      properties: {
        postgres: { type: 'boolean' },
        redis: { type: 'boolean' }
      }
    }
  }
} as const;

export const readyzResponseSchema = healthResponseSchema;
