import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';

export interface SentryBootstrap {
  enabled: boolean;
  captureException(error: unknown, hint?: Record<string, unknown>): void;
  close(): Promise<void>;
}

const noop: SentryBootstrap = {
  enabled: false,
  captureException: () => {
    /* Sentry disabled when DSN is empty. */
  },
  close: async () => {
    /* no-op */
  },
};

export interface InitSentryOptions {
  dsn?: string | null;
  environment: string;
  release?: string;
  serviceName: string;
  tracesSampleRate?: number;
}

export function initSentryNode(options: InitSentryOptions): SentryBootstrap {
  const dsn = options.dsn?.trim();
  if (!dsn) {
    return noop;
  }

  Sentry.init({
    dsn,
    environment: options.environment,
    release: options.release,
    tracesSampleRate: options.tracesSampleRate ?? 0.1,
    sendDefaultPii: false,
    initialScope: {
      tags: { service: options.serviceName },
    },
  });

  return {
    enabled: true,
    captureException: (error, hint) => {
      Sentry.captureException(error, { extra: hint });
    },
    close: async () => {
      await Sentry.close(2000);
    },
  };
}

export function attachFastifySentry(app: FastifyInstance, bootstrap: SentryBootstrap) {
  if (!bootstrap.enabled) {
    return;
  }

  app.addHook('onError', async (request, _reply, error) => {
    bootstrap.captureException(error, {
      request_id: request.id,
      method: request.method,
      url: request.url,
      route: request.routeOptions.url,
    });
  });

  app.addHook('onClose', async () => {
    await bootstrap.close();
  });
}
