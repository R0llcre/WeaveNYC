'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { TopBar } from '@/components/shell/TopBar';
import { Avatar, Button, Card, Icon, Inline, Stack, Tag } from '@/components/ui';
import { useAppSelector } from '@/lib/hooks';
import {
  selectIsVerified,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { useSignOut } from '@/lib/use-sign-out';
import type { SupportedLanguage } from '@/lib/types';

/**
 * Map the 3 supported BCP-47 codes to the label each user expects to read
 * in the Me hub. We intentionally show each label in its own language so a
 * user who already picked `zh` sees "中文" (not "Chinese") next to the
 * Change language row. This is the same pattern the language picker uses.
 */
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文',
};

function currentLanguageLabel(lang: SupportedLanguage): string {
  return LANGUAGE_LABELS[lang] ?? LANGUAGE_LABELS.en;
}

/**
 * MeScreen — W3C `/me` tab destination.
 *
 * Layout shape (top → bottom):
 *
 *   TopBar (title: meTitle)
 *   ── Account card (avatar + display name + verify status caption)
 *   ── Language section    → navigates to /me/settings#language
 *   ── Verify section      → status chip, CTA to /me/verify if unverified
 *   ── Privacy section     → navigates to /me/settings#privacy
 *   ── Account section     → inline sign-out button
 *   ── Danger zone section → subtitle + destructive link to /me/danger
 *
 * The page is a *directory*: almost every action is a link to an existing
 * sub-route. Only the sign-out CTA performs work locally (via useSignOut).
 * Danger-zone copy deliberately lives here but the delete flow itself
 * stays behind the `/me/danger` route so the destructive surface area is
 * isolated from the hub chrome.
 */
export function MeScreen() {
  const t = useTranslations();
  const prefs = useAppSelector(selectPreferences);
  const isVerified = useAppSelector(selectIsVerified);
  const session = useAppSelector(selectSession);
  const signOut = useSignOut();

  const title = t('meTitle');
  // F10: per-route document.title so the browser tab reads "Me — WeaveNYC"
  // once the client-side translation hydrates.
  useEffect(() => {
    document.title = `${title} \u2014 WeaveNYC`;
  }, [title]);

  // Display name: for the pilot the auth session only carries user_id + level
  // (no profile payload). We show the localized "Looking around" copy for
  // signed-out users and a masked user_id prefix for signed-in ones so the
  // avatar monogram has a deterministic seed. Once a real displayName field
  // lands on AuthUser, this computation collapses to `session.user.name`.
  const displayName = useMemo(() => {
    if (!session) return t('meNotSignedIn');
    return `WeaveNYC ${session.user.user_id.slice(0, 6)}`;
  }, [session, t]);

  const avatarName = session ? displayName : '';
  const verifyCaption = isVerified
    ? t('meVerifyStatusVerified')
    : t('meVerifyStatusUnverified');

  const handleSignOut = () => {
    void signOut();
  };

  return (
    <>
      <TopBar title={title} />
      <Stack as="div" gap={5} className="page-content">
        {/* -------------------------------------------------------------- */}
        {/* Account header — avatar + name + verify status caption         */}
        {/* -------------------------------------------------------------- */}
        <Card>
          <Inline gap={4} align="center">
            <Avatar name={avatarName} size="lg" />
            <Stack gap={1}>
              <span className="text-h3">{displayName}</span>
              <span className="text-micro ink-muted">{verifyCaption}</span>
            </Stack>
          </Inline>
        </Card>

        {/* -------------------------------------------------------------- */}
        {/* Language                                                       */}
        {/* -------------------------------------------------------------- */}
        <section aria-labelledby="me-language-heading">
          <h2 id="me-language-heading" className="overline">
            {t('meSectionLanguage')}
          </h2>
          <Card>
            <a href="/me/settings/#language" className="me-screen__row">
              <Inline gap={3} justify="between" align="center">
                <span className="text-body">{t('meActionChangeLanguage')}</span>
                <Inline gap={2} align="center">
                  <Tag tone="neutral">{currentLanguageLabel(prefs.language)}</Tag>
                  <Icon name="chevron-right" size="sm" tone="muted" />
                </Inline>
              </Inline>
            </a>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Verify identity                                                */}
        {/* -------------------------------------------------------------- */}
        <section aria-labelledby="me-verify-heading">
          <h2 id="me-verify-heading" className="overline">
            {t('meSectionVerify')}
          </h2>
          <Card>
            <Stack gap={3}>
              <Inline gap={3} justify="between" align="center">
                <span className="text-body">{verifyCaption}</span>
                {isVerified ? (
                  <Tag tone="verified">{t('meVerifyStatusVerified')}</Tag>
                ) : null}
              </Inline>
              {!isVerified ? (
                <>
                  <p className="text-body-sm ink-secondary">
                    {t('meVerifyHelper')}
                  </p>
                  <Button
                    as="a"
                    href="/me/verify/"
                    variant="primary"
                    size="md"
                    data-testid="me-verify-cta"
                  >
                    {t('meActionVerifyIdentity')}
                  </Button>
                </>
              ) : null}
            </Stack>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Privacy (link to settings subpage)                             */}
        {/* -------------------------------------------------------------- */}
        <section aria-labelledby="me-privacy-heading">
          <h2 id="me-privacy-heading" className="overline">
            {t('meSectionPrivacy')}
          </h2>
          <Card>
            <a href="/me/settings/#privacy" className="me-screen__row">
              <Inline gap={3} justify="between" align="center">
                <span className="text-body">{t('meSectionPrivacy')}</span>
                <Icon name="chevron-right" size="sm" tone="muted" />
              </Inline>
            </a>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Account (sign-out)                                             */}
        {/* -------------------------------------------------------------- */}
        <section aria-labelledby="me-account-heading">
          <h2 id="me-account-heading" className="overline">
            {t('meSectionAccount')}
          </h2>
          <Card>
            <Button
              variant="ghost"
              size="md"
              onClick={handleSignOut}
              data-testid="me-sign-out"
              disabled={!session}
            >
              {t('meActionSignOut')}
            </Button>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Danger zone — visually separated                               */}
        {/* -------------------------------------------------------------- */}
        <section aria-labelledby="me-danger-heading" className="danger-zone">
          <h2 id="me-danger-heading" className="overline ink-danger">
            {t('meSectionDanger')}
          </h2>
          <Card>
            <Stack gap={3}>
              <Stack gap={1}>
                <span className="text-body">{t('meDangerTitle')}</span>
                <span className="text-body-sm ink-muted">
                  {t('meDangerSubtitle')}
                </span>
              </Stack>
              <Button
                as="a"
                href="/me/danger/"
                variant="ghost"
                tone="danger"
                size="md"
                data-testid="me-danger-cta"
              >
                {t('meDangerCta')}
              </Button>
            </Stack>
          </Card>
        </section>
      </Stack>
    </>
  );
}
