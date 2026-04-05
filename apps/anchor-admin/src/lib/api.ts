import { healthcheckResponseSchema } from "@weavenyc/shared";

export const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type HealthStatus = {
  ok: boolean;
  endpoint: string;
  status: number | null;
  detail: string;
};

export async function fetchHealth(endpoint: string): Promise<HealthStatus> {
  try {
    const response = await fetch(`${DEFAULT_API_BASE_URL}${endpoint}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const parsed = healthcheckResponseSchema.safeParse(payload);

    return {
      ok: response.ok,
      endpoint,
      status: response.status,
      detail: parsed.success
        ? `${parsed.data.service} ${parsed.data.status}`
        : response.ok
          ? "reachable"
          : `responded with ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      status: null,
      detail: error instanceof Error ? error.message : "request failed",
    };
  }
}
