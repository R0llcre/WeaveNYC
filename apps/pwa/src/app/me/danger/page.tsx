'use client';

/**
 * M8.5 W8 — `/me/danger`: the destructive account-delete entry point.
 *
 * Wave-8 UX audit fix: the previous W2B placeholder rendered a bare
 * "Delete account — W2" string. This page now owns the full scaffolding
 * for the delete-request flow — PageHeader with a back affordance, the
 * editorial body copy, and a confirm-dialog gate — so M8 pilot users
 * land on a coherent destructive surface instead of a stubbed screen.
 *
 * Wiring status:
 *   - `requestAccountDeletion` is the real api-client helper (see
 *     `apps/pwa/src/lib/api.ts`). On a successful challenge we route
 *     the user back to `/me/settings/` where the full 3-step flow
 *     (OTP confirm → scheduled → undo) continues to live; this page
 *     only owns the commitment step.
 *   - On HTTP 429 we surface `deleteRateLimitError` (dedicated editorial
 *     copy added by the i18n agent this wave).
 *   - Anonymous / unverified session falls back to the same
 *     deleteAuthError messaging that settings-screen.tsx maps.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { Banner, Button, Card, Inline, PageHeader, Stack, Toast } from '@/components/ui';
import { requestAccountDeletion } from '@/lib/api';
import { useAppSelector } from '@/lib/hooks';
import { selectSession } from '@/lib/selectors';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'sent' };

export default function MeDangerPage() {
  const t = useTranslations();
  const router = useRouter();
  const session = useAppSelector(selectSession);
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const title = t('meDangerTitle');

  useEffect(() => {
    document.title = `${title} \u2014 WeaveNYC`;
  }, [title]);

  const handleContinue = useCallback(() => {
    // Step 1 of the two-tap gate: show the confirm block. We intentionally
    // render the confirmation inline instead of `window.confirm()` so the
    // copy stays localized and the destructive CTA is visually weighted.
    setState({ kind: 'confirming' });
  }, []);

  const handleCancel = useCallback(() => {
    setState({ kind: 'idle' });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!session?.access_token) {
      setState({ kind: 'error', message: t('deleteAuthError') });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      await requestAccountDeletion(session.access_token);
      setState({ kind: 'sent' });
      // The 3-step OTP confirm + undo lives on /me/settings/ — push the
      // user there so they see the in-flight challenge banner + the
      // OTP input without having to navigate manually.
      window.setTimeout(() => {
        router.push('/me/settings/');
      }, 800);
    } catch (error) {
      const message =
        error instanceof Error && /HTTP 429/i.test(error.message)
          ? t('deleteRateLimitError')
          : error instanceof Error
            ? error.message
            : t('deleteGenericError');
      setState({ kind: 'error', message });
    }
  }, [router, session?.access_token, t]);

  const isSubmitting = state.kind === 'submitting';
  const isConfirming = state.kind === 'confirming' || isSubmitting || state.kind === 'error';

  return (
    <div className="page-content" data-screen="me-danger">
      <PageHeader
        title={title}
        subtitle={t('meDangerSubtitle')}
        backHref="/me/settings/"
      />

      <Stack gap={5} as="section">
        <Card>
          <Stack gap={3}>
            <h2 className="text-h3">{t('meDeleteStep1Title')}</h2>
            <p className="text-body ink-secondary">
              {t('meDeleteStep1Subtitle')}
            </p>

            {state.kind === 'error' ? (
              <Banner tone="danger" title={state.message} />
            ) : null}

            {isConfirming ? (
              <>
                {/* Two-tap confirm gate — the body copy above states what
                    "delete" means; this block asks for explicit
                    commitment before we fire the network request.
                    P6 UX finding 6: append the peer-cache notice so the
                    user understands the server purge does NOT reach
                    other community members' devices immediately. */}
                <Banner tone="warning" title={t('deleteAccountSummary')}>
                  {t('deleteAccountBody')}
                  {' '}
                  {t('deleteAccountP2PNotice')}
                </Banner>
                <Inline gap={3} wrap>
                  <Button
                    variant="danger"
                    size="lg"
                    data-testid="me-danger-confirm"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    onClick={() => void handleSubmit()}
                    haptic
                  >
                    {isSubmitting
                      ? t('deleteRequestSending')
                      : t('meDeleteStep2Cta')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    disabled={isSubmitting}
                    onClick={handleCancel}
                    data-testid="me-danger-cancel"
                  >
                    {t('buttonCancel')}
                  </Button>
                </Inline>
              </>
            ) : (
              <Inline gap={3} wrap>
                <Button
                  variant="danger"
                  size="lg"
                  data-testid="me-danger-continue"
                  onClick={handleContinue}
                  haptic
                >
                  {t('meDeleteStep1Cta')}
                </Button>
              </Inline>
            )}
          </Stack>
        </Card>

        {state.kind === 'sent' ? (
          <Toast
            tone="info"
            title={t('deleteOtpSent')}
            data-testid="me-danger-toast"
          />
        ) : null}
      </Stack>
    </div>
  );
}
