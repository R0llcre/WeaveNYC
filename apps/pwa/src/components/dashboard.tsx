'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  createAnonymousSession,
  getApiBaseUrl,
  probeEndpoint,
  type AnonymousSessionResponse,
} from '@/lib/api';
import { clearSession, setSession } from '@/lib/slices/auth-slice';

function HealthBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`status-badge ${ok ? 'status-badge--ok' : 'status-badge--error'}`}>
      {ok ? 'Reachable' : 'Unavailable'}
    </span>
  );
}

function maskToken(token: string) {
  if (token.length <= 16) {
    return token;
  }

  return `${token.slice(0, 12)}…${token.slice(-8)}`;
}

export function Dashboard() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const session = useAppSelector((state) => state.auth.session);

  const healthzQuery = useQuery({
    queryKey: ['api-health', 'healthz'],
    queryFn: () => probeEndpoint('/healthz'),
    refetchInterval: 30000,
  });

  const readyzQuery = useQuery({
    queryKey: ['api-health', 'readyz'],
    queryFn: () => probeEndpoint('/readyz'),
    refetchInterval: 30000,
  });

  const anonymousSessionMutation = useMutation({
    mutationFn: createAnonymousSession,
    onSuccess: (response: AnonymousSessionResponse) => {
      dispatch(setSession(response));
    },
  });

  const handleRefreshHealth = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['api-health', 'healthz'] }),
      queryClient.invalidateQueries({ queryKey: ['api-health', 'readyz'] }),
    ]);
  };

  return (
    <main className="shell">
      <div className="shell__inner">
        <section className="hero">
          <span className="hero__eyebrow">M0 PWA shell</span>
          <h1>Check the API, mint an anonymous session, and stop there.</h1>
          <p>
            This screen is intentionally narrow for M0. It proves the PWA shell,
            service worker, API reachability, and anonymous auth bootstrap without
            leaking into resource search, posts, or matching.
          </p>
        </section>

        <section className="grid">
          <article className="card card--health">
            <h2>API health</h2>
            <p className="card__subtitle">
              Base URL: <code>{getApiBaseUrl()}</code>
            </p>

            <div className="health-list">
              {[healthzQuery.data, readyzQuery.data].map((item, index) => {
                const label = index === 0 ? 'GET /healthz' : 'GET /readyz';
                const description =
                  index === 0 ? 'Liveness check for the API process.' : 'Readiness check for DB and Redis.';
                const ok = item?.ok ?? false;
                const detail = item?.detail ?? description;

                return (
                  <div className="health-item" key={label}>
                    <div className="health-item__meta">
                      <strong>{label}</strong>
                      <span>{detail}</span>
                    </div>
                    <HealthBadge ok={ok} />
                  </div>
                );
              })}
            </div>

            <div className="actions">
              <button className="button button--secondary" onClick={() => void handleRefreshHealth()} type="button">
                Refresh health
              </button>
            </div>
          </article>

          <article className="card card--session">
            <h2>Anonymous session</h2>
            <p className="card__subtitle">
              Calls <code>POST /v1/auth/anonymous</code> and stores the latest result in a minimal RTK auth slice.
            </p>

            <div className="actions">
              <button
                className="button button--primary"
                disabled={anonymousSessionMutation.isPending}
                onClick={() => anonymousSessionMutation.mutate()}
                type="button"
              >
                {anonymousSessionMutation.isPending ? 'Creating session…' : 'Create anonymous session'}
              </button>
              <button className="button button--secondary" onClick={() => dispatch(clearSession())} type="button">
                Clear panel
              </button>
            </div>

            <div className="hint">
              The session result panel below is intentionally simple. M0 only proves the transport and shape of the auth response.
            </div>
          </article>
        </section>

        <section className="card">
          <div style={{ padding: 24 }}>
            <h2>Result panel</h2>
            <p className="card__subtitle">
              Last successful response from the anonymous session endpoint, or the latest error if the call failed.
            </p>

            {anonymousSessionMutation.isError ? (
              <div className="result-panel">
                <div className="result-block">
                  <strong>Request failed</strong>
                  <pre className="result-code">
                    {anonymousSessionMutation.error instanceof Error
                      ? anonymousSessionMutation.error.message
                      : 'Unknown error'}
                  </pre>
                </div>
              </div>
            ) : null}

            {session ? (
              <div className="result-panel">
                <div className="meta-strip">
                  <span className="meta-chip">user_id: {session.user.user_id}</span>
                  <span className="meta-chip">level: {session.user.level}</span>
                </div>
                <div className="result-block">
                  <strong>access_token</strong>
                  <pre className="result-code">{maskToken(session.access_token)}</pre>
                </div>
                <div className="result-block">
                  <strong>refresh_token</strong>
                  <pre className="result-code">{maskToken(session.refresh_token)}</pre>
                </div>
                <div className="result-block">
                  <strong>Full response</strong>
                  <pre className="result-code">{JSON.stringify(session, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="result-empty">
                No anonymous session yet. Use the button above once the API is reachable.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
