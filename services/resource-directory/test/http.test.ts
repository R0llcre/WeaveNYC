import { describe, expect, it, vi } from 'vitest';

import { fetchWithRetry } from '../src/lib/http.js';

describe('fetchWithRetry', () => {
  it('retries transient fetch failures before succeeding', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('socket hang up'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const response = await fetchWithRetry('https://example.com/resource');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });
});
