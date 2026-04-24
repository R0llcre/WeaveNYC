import { WebSocket } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

import { createTestApp, createUserRecord, InMemoryUserStore } from './helpers.js';

// Focused coverage for the P0-3 server WebSocket heartbeat + stale-socket
// detection work. These tests open a real WS connection against an
// ephemeral-port Fastify app so the ping/pong handshake and the
// stale-socket sweep are exercised on the actual route handler, not a
// mock.

// F4-A Fix #3: tests assume Origin is checked against `corsAllowedOrigins`.
// The test config allows `http://localhost:*` so every "should succeed"
// test passes an origin the matcher accepts; the new "should reject"
// suite pins the mismatch + missing-origin close codes.
const ALLOWED_ORIGIN = 'http://localhost:3000';

const requesterId = '11111111-1111-4111-8111-111111111111';
const communityId = '44444444-4444-4444-8444-444444444444';

function signUser(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  user: ReturnType<typeof createUserRecord>,
) {
  return app.jwt.sign(
    {
      sub: user.userId,
      level: user.level,
      role: user.role,
      community_ids: user.communityIds,
      anchor_community_id: user.anchorCommunityId ?? undefined,
      mfa_verified_at: user.mfaVerifiedAt,
    },
    {
      algorithm: 'RS256',
      iss: app.config.jwt.issuer,
      expiresIn: app.config.jwt.accessTokenTtl,
    },
  );
}

describe('chat-socket route (P0-3 heartbeat + stale sweep)', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  async function startApp() {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: requesterId,
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    const testApp = await createTestApp({ userStore });
    apps.push(testApp.app);
    const token = signUser(testApp.app, requester);
    await testApp.app.listen({ host: '127.0.0.1', port: 0 });
    const address = testApp.app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected a bound server address');
    }
    return { ...testApp, token, port: address.port };
  }

  it('responds to client-sent pings with pongs and refreshes last-activity', async () => {
    const { app, token, port } = await startApp();

    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v1/ws/chat?token=${encodeURIComponent(token)}`,
      { origin: ALLOWED_ORIGIN },
    );

    // Wait until we receive a frame matching `{type: "pong"}` — the
    // route also sends a `heartbeat` greeting on attach, so we filter
    // by shape instead of counting messages.
    const pongPromise = new Promise<{ type: string; t: number }>((resolve, reject) => {
      socket.on('message', (raw: Buffer) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed?.type === 'pong') resolve(parsed);
        } catch {
          /* ignore non-JSON frames */
        }
      });
      socket.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('open', () => resolve());
      socket.on('error', reject);
    });

    socket.send(JSON.stringify({ type: 'ping' }));

    const parsed = await pongPromise;
    expect(parsed.type).toBe('pong');
    expect(typeof parsed.t).toBe('number');

    // Live-socket registry should still have this connection.
    expect(app.chatSocketLiveCountForTest()).toBe(1);

    socket.close();
  });

  it('terminates a socket that has not pinged within the 90s window', async () => {
    const { app, token, port } = await startApp();

    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v1/ws/chat?token=${encodeURIComponent(token)}`,
      { origin: ALLOWED_ORIGIN },
    );

    // Wait for the connection to fully attach (server registers it in
    // `liveSockets` during the route handler, after the greeting send).
    await new Promise<void>((resolve, reject) => {
      socket.on('open', () => resolve());
      socket.on('error', reject);
    });

    // Give the route handler a tick to wire up the server-side close
    // listener on the attached socket.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(app.chatSocketLiveCountForTest()).toBe(1);

    // Jump the sweeper's clock 2 minutes into the future — well past the
    // 90s stale threshold. The server must terminate the socket, evict
    // it from the hub registry, and drop it from the live set.
    const clientClosePromise = new Promise<number>((resolve) => {
      socket.on('close', (code: number) => resolve(code));
    });

    // Silence post-terminate ECONNRESET noise from the `ws` client library.
    // `socket.terminate()` on the server abruptly kills the TCP stream;
    // the client-side `ws` runtime still has an in-flight write (the
    // heartbeat greeting ACK) which surfaces as an 'error' event AFTER
    // 'close'. Left unhandled it bubbles as a Vitest unhandled rejection
    // and turns an otherwise-passing assertion into a file-level failure
    // ("connect ECONNRESET 127.0.0.1:..."). Swallow it — the close event
    // is what we're testing.
    socket.on('error', () => {
      /* post-terminate noise; the test only cares about the close event */
    });

    app.chatSocketSweepForTest(Date.now() + 120_000);

    // The client should observe the terminate as a close event.
    await clientClosePromise;
    expect(app.chatSocketLiveCountForTest()).toBe(0);
  });

  it('keeps a socket alive when pings arrive faster than the stale threshold', async () => {
    const { app, token, port } = await startApp();

    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v1/ws/chat?token=${encodeURIComponent(token)}`,
      { origin: ALLOWED_ORIGIN },
    );

    // Collect messages from the moment the socket is constructed. We
    // wait for two (the heartbeat greeting + the pong to our ping) so
    // we're sure the server processed our ping before the sweep runs.
    const messages: string[] = [];
    const pongSeen = new Promise<void>((resolve, reject) => {
      socket.on('message', (raw: Buffer) => {
        const text = raw.toString();
        messages.push(text);
        try {
          const parsed = JSON.parse(text);
          if (parsed?.type === 'pong') resolve();
        } catch {
          /* ignore non-JSON frames */
        }
      });
      socket.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('open', () => resolve());
      socket.on('error', reject);
    });

    // Give the server a tick to finish wiring the server-side message
    // listener after `attachConnection` runs.
    await new Promise((resolve) => setTimeout(resolve, 10));

    socket.send(JSON.stringify({ type: 'ping' }));
    await pongSeen;

    // Run the sweep a mere 30s in the future — well below the 90s
    // threshold measured from the ping's `lastPongAt`. The socket
    // must stay alive.
    app.chatSocketSweepForTest(Date.now() + 30_000);

    expect(app.chatSocketLiveCountForTest()).toBe(1);
    socket.close();
  });
});

// F4-A Fix #3: WS Origin header check. `@fastify/cors` only gates the
// HTTP preflight — the WS upgrade path previously accepted any origin
// and authenticated solely off the query-string JWT. A leaked `chat_ws`
// token could be replayed from any web origin. The handshake must now
// match against the same `corsAllowedOrigins` list (expanded wildcards)
// as the HTTP layer.
describe('chat-socket route (F4-A Fix #3: WS Origin check)', () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  async function startApp() {
    const userStore = new InMemoryUserStore();
    const requester = createUserRecord({
      userId: requesterId,
      level: 'verified',
      communityIds: [communityId],
    });
    userStore.users.set(requester.userId, requester);
    const testApp = await createTestApp({ userStore });
    apps.push(testApp.app);
    const token = signUser(testApp.app, requester);
    await testApp.app.listen({ host: '127.0.0.1', port: 0 });
    const address = testApp.app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('expected a bound server address');
    }
    return { ...testApp, token, port: address.port };
  }

  it('closes the socket with 1008 when Origin is missing', async () => {
    const { token, port } = await startApp();

    // Node `ws` does not emit an Origin header by default — this exercises
    // the "missing origin" branch. The handler must reject with 1008.
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v1/ws/chat?token=${encodeURIComponent(token)}`,
    );

    const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
      socket.once('close', (code: number, reason: Buffer) =>
        resolve({ code, reason: reason.toString() }),
      );
    });
    expect(closeEvent.code).toBe(1008);
    expect(closeEvent.reason).toBe('Invalid origin');
  });

  // Note on "mismatched origin": the HTTP `@fastify/cors` middleware runs
  // BEFORE the WS upgrade handler and rejects any non-allow-listed Origin
  // with a 500 at the transport layer — the WS handler never runs. The
  // route's own origin matcher is defence-in-depth for the case where CORS
  // is misconfigured or bypassed. We don't live-test the mismatched-origin
  // close-1008 branch directly because CORS preempts it, and a refused HTTP
  // upgrade leaves a half-closed TCP pair that breaks test teardown; the
  // missing-origin test exercises the handler-level branch when CORS lets
  // the request through (its allow-missing-origin fallback).

  it('accepts a handshake whose Origin matches the configured allow-list', async () => {
    const { app, token, port } = await startApp();

    // The test config allows `http://localhost:*`, so this origin is
    // explicitly on the list. The socket must open and the live-count
    // decorator must reflect that.
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v1/ws/chat?token=${encodeURIComponent(token)}`,
      { origin: ALLOWED_ORIGIN },
    );

    await new Promise<void>((resolve, reject) => {
      socket.on('open', () => resolve());
      socket.on('error', reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(app.chatSocketLiveCountForTest()).toBe(1);

    socket.close();
  });
});
