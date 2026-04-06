import { randomUUID } from "node:crypto";
import process from "node:process";

type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  issued_via?: string;
  fallback?: boolean;
  user: {
    user_id: string;
    level: string;
  };
};

type OtpStartResponse = {
  challenge_id: string;
  fallback: boolean;
  demo_code?: string;
};

type MagicLinkStartResponse = {
  challenge_id: string;
  fallback: boolean;
  demo_token?: string;
};

type ResourceListResponse = {
  items: Array<{
    provider_id: string;
    name: string;
  }>;
};

type ResourceDetailResponse = {
  provider_id: string;
  weekly_hours: unknown[];
};

const apiBaseUrl = (process.env.WEAVENYC_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const smokeZip = process.env.WEAVENYC_SMOKE_ZIP ?? "11735";
const minResources = Number(process.env.WEAVENYC_SMOKE_MIN_RESOURCES ?? "3");
const startupTimeoutMs = Number(process.env.WEAVENYC_SMOKE_TIMEOUT_MS ?? "60000");

async function main() {
  await waitForReady();

  const health = await fetchJson("/healthz");
  assert(health.response.status === 200, `Expected GET /healthz to return 200, got ${health.response.status}`);

  const ready = await fetchJson("/readyz");
  assert(ready.response.status === 200, `Expected GET /readyz to return 200, got ${ready.response.status}`);

  const anonymous = await fetchJson<AuthSessionResponse>("/v1/auth/anonymous", {
    method: "POST",
    body: JSON.stringify({
      device_id: randomUUID()
    })
  });
  assert(anonymous.response.status === 200, `Expected POST /v1/auth/anonymous to return 200, got ${anonymous.response.status}`);
  assert(Boolean(anonymous.body?.access_token), "Anonymous session did not return access_token");
  assert(Boolean(anonymous.body?.refresh_token), "Anonymous session did not return refresh_token");
  assert(anonymous.body?.user.level === "anonymous", `Expected anonymous level, got ${anonymous.body?.user.level ?? "<missing>"}`);

  const refreshed = await fetchJson<AuthSessionResponse>("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: anonymous.body.refresh_token
    })
  });
  assert(refreshed.response.status === 200, `Expected POST /v1/auth/refresh to return 200, got ${refreshed.response.status}`);
  assert(refreshed.body?.refresh_token !== anonymous.body.refresh_token, "Refresh rotation did not mint a new refresh token");
  assert(Boolean(refreshed.body?.access_token), "Refresh rotation did not return access_token");

  const replayedRefresh = await fetchJson<{ message?: string }>("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: anonymous.body.refresh_token
    })
  });
  assert(replayedRefresh.response.status === 401, `Expected replayed refresh token to return 401, got ${replayedRefresh.response.status}`);

  const meUnauthorized = await fetchRaw("/v1/me");
  assert(meUnauthorized.status === 401, `Expected GET /v1/me without token to return 401, got ${meUnauthorized.status}`);

  const meAuthorized = await fetchJson("/v1/me", {
    headers: {
      authorization: `Bearer ${refreshed.body.access_token}`
    }
  });
  assert(meAuthorized.response.status === 200, `Expected GET /v1/me with token to return 200, got ${meAuthorized.response.status}`);

  const otpStart = await fetchJson<OtpStartResponse>("/v1/auth/otp/start", {
    method: "POST",
    headers: {
      authorization: `Bearer ${refreshed.body.access_token}`
    },
    body: JSON.stringify({
      phone: "+15165550101"
    })
  });
  assert(otpStart.response.status === 200, `Expected POST /v1/auth/otp/start to return 200, got ${otpStart.response.status}`);
  assert(otpStart.body?.fallback === true, "OTP smoke expected stub provider fallback");
  assert(Boolean(otpStart.body?.demo_code), "OTP smoke expected stub demo_code");

  const otpVerify = await fetchJson<AuthSessionResponse>("/v1/auth/otp/verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${refreshed.body.access_token}`
    },
    body: JSON.stringify({
      challenge_id: otpStart.body.challenge_id,
      code: otpStart.body.demo_code
    })
  });
  assert(otpVerify.response.status === 200, `Expected POST /v1/auth/otp/verify to return 200, got ${otpVerify.response.status}`);
  assert(otpVerify.body?.user.level === "verified", `Expected OTP verify to upgrade user to verified, got ${otpVerify.body?.user.level ?? "<missing>"}`);

  const magicLinkSession = await fetchJson<AuthSessionResponse>("/v1/auth/anonymous", {
    method: "POST",
    body: JSON.stringify({
      device_id: randomUUID()
    })
  });
  assert(magicLinkSession.response.status === 200, `Expected second POST /v1/auth/anonymous to return 200, got ${magicLinkSession.response.status}`);

  const magicLinkStart = await fetchJson<MagicLinkStartResponse>("/v1/auth/magic-link/start", {
    method: "POST",
    headers: {
      authorization: `Bearer ${magicLinkSession.body.access_token}`
    },
    body: JSON.stringify({
      email: "neighbor@example.com"
    })
  });
  assert(magicLinkStart.response.status === 200, `Expected POST /v1/auth/magic-link/start to return 200, got ${magicLinkStart.response.status}`);
  assert(magicLinkStart.body?.fallback === true, "Magic-link smoke expected stub provider fallback");
  assert(Boolean(magicLinkStart.body?.demo_token), "Magic-link smoke expected stub demo_token");

  const magicLinkVerify = await fetchJson<AuthSessionResponse>("/v1/auth/magic-link/verify", {
    method: "POST",
    body: JSON.stringify({
      challenge_id: magicLinkStart.body.challenge_id,
      token: magicLinkStart.body.demo_token
    })
  });
  assert(magicLinkVerify.response.status === 200, `Expected POST /v1/auth/magic-link/verify to return 200, got ${magicLinkVerify.response.status}`);
  assert(magicLinkVerify.body?.user.level === "verified", `Expected magic-link verify to upgrade user to verified, got ${magicLinkVerify.body?.user.level ?? "<missing>"}`);

  const resources = await fetchJson<ResourceListResponse>(`/v1/resources?zip=${encodeURIComponent(smokeZip)}&limit=5`);
  assert(resources.response.status === 200, `Expected GET /v1/resources to return 200, got ${resources.response.status}`);
  assert(
    Array.isArray(resources.body?.items) && resources.body.items.length >= minResources,
    `Expected at least ${minResources} resources for ZIP ${smokeZip}, got ${resources.body?.items?.length ?? 0}`
  );

  const providerId = resources.body.items[0]?.provider_id;
  assert(Boolean(providerId), "Resource list did not include a provider_id");

  const detail = await fetchJson<ResourceDetailResponse>(
    `/v1/resources/${encodeURIComponent(providerId)}?zip=${encodeURIComponent(smokeZip)}`
  );
  assert(detail.response.status === 200, `Expected GET /v1/resources/:provider_id to return 200, got ${detail.response.status}`);
  assert(Array.isArray(detail.body?.weekly_hours), "Resource detail did not include weekly_hours");

  const docs = await fetchRaw("/docs");
  assert(docs.status === 200, `Expected GET /docs to return 200, got ${docs.status}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBaseUrl,
        smokeZip,
        checked: [
          "GET /healthz",
          "GET /readyz",
          "POST /v1/auth/anonymous",
          "POST /v1/auth/refresh",
          "POST /v1/auth/refresh (replay -> 401)",
          "GET /v1/me (401)",
          "GET /v1/me (200)",
          "POST /v1/auth/otp/start",
          "POST /v1/auth/otp/verify",
          "POST /v1/auth/magic-link/start",
          "POST /v1/auth/magic-link/verify",
          "GET /v1/resources",
          "GET /v1/resources/:provider_id",
          "GET /docs"
        ],
        resourceCount: resources.body.items.length,
        providerId
      },
      null,
      2
    )
  );
}

async function waitForReady() {
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetchRaw("/readyz");
      if (response.status === 200) {
        return;
      }
    } catch {
      // Wait for API bootstrap.
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting ${startupTimeoutMs}ms for ${apiBaseUrl}/readyz`);
}

async function fetchJson<T = unknown>(path: string, init: RequestInit = {}) {
  const response = await fetchRaw(path, init);
  const body = (await response.json()) as T;
  return { response, body };
}

async function fetchRaw(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
