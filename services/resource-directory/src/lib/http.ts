function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FetchRetryOptions = {
  attempts?: number;
  retryDelayMs?: number;
};

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  options: FetchRetryOptions = {}
): Promise<Response> {
  const attempts = options.attempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 500;
  let lastError: unknown;

  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(input, init);
      if (response.status >= 500 && index < attempts - 1) {
        await delay(retryDelayMs * (index + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (index === attempts - 1) {
        break;
      }
      await delay(retryDelayMs * (index + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetch failed');
}
