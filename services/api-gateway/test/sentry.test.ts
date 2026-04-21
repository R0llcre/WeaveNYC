/**
 * F4-F6 — smoke coverage for Sentry wiring on the api-gateway.
 *
 * The gateway calls `initSentryNode(...)` before constructing the
 * Fastify app (services/api-gateway/src/app.ts:111) and then wires
 * `attachFastifySentry` to capture unhandled route errors. Without a
 * test, a regression that (a) stops passing the DSN through, (b)
 * removes the `Sentry.init` call, or (c) detaches the `onError` hook
 * would go unnoticed until production stopped receiving events.
 *
 * Strategy: mock `@sentry/node` at the module boundary so we can assert
 * that `init` was (or was NOT) called, observe `captureException`
 * invocations, and avoid any real network egress during the test run.
 * The mock is declared BEFORE importing anything that touches
 * `@sentry/node` (the transitive import graph via `lib/sentry.ts`) so
 * vitest's module registry hands out the fake instead.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  close: vi.fn(async () => true),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    callback({ setTag: vi.fn(), setExtra: vi.fn() });
  }),
}));

vi.mock('@sentry/node', () => ({
  init: sentryMocks.init,
  captureException: sentryMocks.captureException,
  close: sentryMocks.close,
  withScope: sentryMocks.withScope,
}));

// The mock must be installed before these imports are resolved. The
// helpers / config modules transitively load `lib/sentry.ts`, which
// imports `@sentry/node` — so vitest sees the mock first.
import { createTestApp, createTestConfig } from './helpers.js';

describe('Sentry bootstrap', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  beforeEach(() => {
    sentryMocks.init.mockReset();
    sentryMocks.captureException.mockReset();
    sentryMocks.close.mockReset();
    sentryMocks.close.mockResolvedValue(true);
    sentryMocks.withScope.mockImplementation((callback: (scope: unknown) => void) => {
      callback({ setTag: vi.fn(), setExtra: vi.fn() });
    });
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it('does NOT call Sentry.init when SENTRY_DSN is empty', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it('calls Sentry.init with the expected options when a DSN is provided', async () => {
    const config = createTestConfig();
    const { app } = await createTestApp({
      config: {
        ...config,
        sentry: {
          dsn: 'https://public@sentry.test/1',
          tracesSampleRate: 0.25,
        },
      },
    });
    apps.push(app);

    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
    const initArgs = sentryMocks.init.mock.calls[0]?.[0];
    expect(initArgs).toMatchObject({
      dsn: 'https://public@sentry.test/1',
      environment: config.env,
      tracesSampleRate: 0.25,
      sendDefaultPii: false,
    });
    // The bootstrap tags the scope with the service name so backend
    // projects can filter. Lock the tag in as a regression fence.
    expect(initArgs?.initialScope?.tags).toMatchObject({
      service: 'api-gateway',
    });
  });

  it('forwards unhandled route errors to Sentry.captureException via the attached hook', async () => {
    const config = createTestConfig();
    const { app } = await createTestApp({
      config: {
        ...config,
        sentry: {
          dsn: 'https://public@sentry.test/1',
          tracesSampleRate: 0.1,
        },
      },
    });
    apps.push(app);

    // Register a route that throws after Sentry is wired up. The
    // onError hook installed by attachFastifySentry should fire with
    // the thrown value and call captureException with request context.
    const boomError = new Error('boom-for-sentry-smoke');
    app.get('/__test__/boom', async () => {
      throw boomError;
    });

    const response = await app.inject({
      method: 'GET',
      url: '/__test__/boom',
    });

    expect(response.statusCode).toBe(500);
    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    const [errorArg, hintArg] = sentryMocks.captureException.mock.calls[0] ?? [];
    expect(errorArg).toBe(boomError);
    // Hint shape mirrors attachFastifySentry's contract: it passes an
    // `extra` bag with request_id + method + url at minimum.
    expect(hintArg).toMatchObject({
      extra: expect.objectContaining({
        method: 'GET',
        url: '/__test__/boom',
      }),
    });
  });

  it('does NOT attach the onError hook when the DSN is empty (negative path)', async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const boomError = new Error('should-not-reach-sentry');
    app.get('/__test__/boom-no-dsn', async () => {
      throw boomError;
    });

    const response = await app.inject({
      method: 'GET',
      url: '/__test__/boom-no-dsn',
    });

    expect(response.statusCode).toBe(500);
    // The no-op bootstrap short-circuits attachFastifySentry, so no
    // captureException call should fire even though the route threw.
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });
});
