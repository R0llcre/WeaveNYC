import type { AppConfig } from '../config.js';
import type { AuthTokenClaims, InternalServiceTokenClaims } from '../types.js';
import { getRequestId } from './request-context.js';

export type InternalServiceName =
  | 'posts'
  | 'match'
  | 'chat'
  | 'resource-directory'
  | 'notifications';

const serviceAudienceMap: Record<InternalServiceName, string | null> = {
  posts: 'posts-service',
  match: 'match-service',
  chat: 'chat-service',
  'resource-directory': 'resource-directory-service',
  notifications: 'notifications-service',
};

export class InternalServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
    readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'InternalServiceError';
  }
}

export function buildInternalActorClaims(
  actor:
    | (AuthTokenClaims & {
        status?: 'active' | 'suspended' | 'deleted';
      })
    | null
    | undefined,
): InternalServiceTokenClaims['actor'] {
  if (!actor) {
    return undefined;
  }

  return {
    sub: actor.sub,
    level: actor.level,
    role: actor.role,
    community_ids: actor.community_ids,
    anchor_community_id: actor.anchor_community_id,
    mfa_verified_at: actor.mfa_verified_at,
    status: actor.status,
  };
}

export function signInternalServiceToken(
  app: { serviceJwt: { sign: (payload: InternalServiceTokenClaims) => string }; config: AppConfig },
  service: InternalServiceName,
  actor?: InternalServiceTokenClaims['actor'],
): string {
  const audience = serviceAudienceMap[service];
  if (!audience) {
    throw new InternalServiceError(`Internal service ${service} is not configured`, 500);
  }

  return app.serviceJwt.sign({
    sub: app.config.runtime.serviceName,
    iss: `${app.config.jwt.issuer}:internal`,
    aud: audience,
    scope: 'internal_service',
    request_id: getRequestId(),
    actor,
  });
}

export function getInternalServiceBaseUrl(config: AppConfig, service: InternalServiceName): string | null {
  switch (service) {
    case 'posts':
      return config.internalServices.postsServiceUrl;
    case 'match':
      return config.internalServices.matchServiceUrl;
    case 'chat':
      return config.internalServices.chatServiceUrl;
    case 'resource-directory':
      return config.internalServices.resourceDirectoryServiceUrl;
    case 'notifications':
      return config.internalServices.notificationsServiceUrl;
  }
}

export async function requestInternalJson<T>(
  app: {
    serviceJwt: { sign: (payload: InternalServiceTokenClaims) => string };
    config: AppConfig;
  },
  service: InternalServiceName,
  init: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    query?: URLSearchParams;
    body?: unknown;
    actor?: InternalServiceTokenClaims['actor'];
  },
): Promise<T> {
  const baseUrl = getInternalServiceBaseUrl(app.config, service);
  if (!baseUrl) {
    throw new InternalServiceError(`Internal service URL is not configured for ${service}`, 500);
  }

  const url = new URL(init.path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (init.query) {
    url.search = init.query.toString();
  }

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${signInternalServiceToken(app, service, init.actor)}`,
      'content-type': 'application/json',
      'x-weavenyc-request-id': getRequestId(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Internal service ${service} responded with ${response.status}`;
    throw new InternalServiceError(message, response.status, payload);
  }

  return payload as T;
}

export function toAuthTokenClaims(actor: NonNullable<InternalServiceTokenClaims['actor']>): AuthTokenClaims {
  return {
    sub: actor.sub,
    level: actor.level,
    role: actor.role,
    community_ids: actor.community_ids,
    anchor_community_id: actor.anchor_community_id,
    mfa_verified_at: actor.mfa_verified_at,
  };
}
