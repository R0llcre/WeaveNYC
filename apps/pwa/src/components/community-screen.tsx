'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { CommunityAnnouncements } from '@/components/community-announcements';
import { PostCard } from '@/components/post-card';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  Inline,
  Pill,
  Skeleton,
  Stack,
  Tag,
  Toast,
} from '@/components/ui';
import { TopBar } from '@/components/shell';
import { createAnonymousSession } from '@/lib/api';
import { isP2PDevDemoVisible } from '@/lib/p2p-env';
import { useAppDispatch, useAppSelector, useCommunityP2PSync, usePosts } from '@/lib/hooks';
import { filterVisiblePostsForScope, loadCachedPosts, saveCachedPosts } from '@/lib/persistence';
import {
  selectCommunity,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';
import { setCurrentCommunity } from '@/lib/slices/community-slice';
import type {
  CachedPostsValue,
  P2PSyncErrorCategory,
  P2PSyncPhase,
} from '@/lib/types';
import type { TagTone } from '@/components/ui/Tag';

/**
 * Maps the P2P sync phase → a Tag tone. Previously `ready` rendered verified
 * and everything else rendered neutral, which made "weak signal" (degraded)
 * and "offline" visually identical (audit P6 finding 11). This mapping gives
 * each phase its own colour + also covers the new `auth_required` / `forbidden`
 * terminal states.
 */
const P2P_PHASE_TONE: Record<P2PSyncPhase, TagTone> = {
  ready: 'verified',
  connecting: 'neutral',
  degraded: 'warning',
  offline: 'danger',
  disabled: 'muted',
  auth_required: 'danger',
  forbidden: 'danger',
};

/**
 * The audit (P6 finding 2) flagged that sync state transitions weren't
 * announced to screen readers. `assertive` for terminal / destructive phases
 * so assistive tech interrupts with the message; `polite` for the steady-state
 * ready/connecting transitions so we don't spam the SR user.
 */
const ASSERTIVE_PHASES: ReadonlySet<P2PSyncPhase> = new Set<P2PSyncPhase>([
  'offline',
  'degraded',
  'auth_required',
  'forbidden',
]);

/**
 * P6 UX finding 10 — map the worker-emitted `errorCategory` onto localized
 * i18n keys so users see translated copy instead of raw English. The raw
 * `lastError` text is still rendered as a muted footnote for on-call
 * debugging (Sentry breadcrumbs keep the English original anyway).
 */
const P2P_ERROR_I18N_KEY: Record<P2PSyncErrorCategory, string> = {
  auth: 'p2pError_auth',
  network: 'p2pError_network',
  server: 'p2pError_server',
  // `schema` is emitted by the worker when a server frame fails Zod
  // validation (added alongside runtime validation in the protocol-version
  // PR). For now we map it to the generic unknown-error copy so the
  // existing 3-locale i18n coverage applies. A dedicated `p2pError_schema`
  // key can land in a UX follow-up — the worker already tags Sentry with
  // `errorCategory: 'schema'` so on-call can distinguish it from a true
  // unknown.
  schema: 'p2pError_unknown',
  unknown: 'p2pError_unknown',
};

/**
 * P6 UX finding 10 — `forbidden` is a phase, not an `errorCategory` value,
 * but when the worker transitions here it carries its own copy. We keep the
 * mapping separate so the community-screen can look up the right key from
 * either the error category or the phase.
 */
function resolveP2PErrorKey(
  phase: P2PSyncPhase,
  category: P2PSyncErrorCategory | null | undefined,
): string {
  if (phase === 'forbidden') {
    return 'p2pError_forbidden';
  }
  if (category) {
    return P2P_ERROR_I18N_KEY[category];
  }
  return 'p2pError_unknown';
}

/**
 * CommunityScreen — /community.
 *
 * W3B redesign: one screen, one intent. Structure flows top-to-bottom:
 *   1. TopBar with eyebrow + title (shell atom, owns back affordance).
 *   2. Hero card — either a join CTA when the user has no membership, or a
 *      "you are in {name}" summary card with the current community info.
 *   3. Sync, announcements, and feed cards are only rendered once the user
 *      has joined a community.
 *
 * The business logic (Redux community slice, useCommunityP2PSync, usePosts,
 * cached fallback) is preserved verbatim from the previous version — we only
 * changed how it renders. That keeps the P2P sync contract and offline
 * fallback semantics intact while letting the layout breathe via Stack/Inline
 * primitives instead of raw flex divs.
 *
 * W3 review follow-up:
 *   - Outer container standardised on `.page-content` (drops the legacy
 *     `.shell__inner` grid so AppShell's `<main>` is the only scroll parent).
 *   - P2P sync metrics migrated to a semantic `<dl>` (`.metric-list`) so
 *     label/value pairs survive the tree flattening assistive tech does.
 *   - Post-feed loading state now renders three stacked `<Skeleton>` rects
 *     with `aria-busy` on the wrapper, matching Home + Matches.
 *
 * E2E-protected testid preserved on this screen: `join-community`.
 */
export function CommunityScreen() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const preferences = useAppSelector(selectPreferences);
  const communityState = useAppSelector(selectCommunity);
  const [tab, setTab] = useState<'community' | 'public'>('community');
  const [isCreatingSession, setCreatingSession] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [cachedPosts, setCachedPosts] = useState<CachedPostsValue | null>(null);
  // P6 UX finding 2 (addendum) — transient "Posts are up to date" toast
  // when the phase transitions back to `ready` from connecting/degraded.
  // Auto-dismisses after ~2s so it doesn't linger. We track the previous
  // phase via a ref so we only fire on the transition edge, not every
  // render where phase === 'ready'.
  const [showReadyToast, setShowReadyToast] = useState(false);
  const previousPhaseRef = useRef<P2PSyncPhase | null>(null);

  const currentCommunity = useMemo(
    () =>
      communityState.joinedCommunities.find(
        (item) => item.community.community_id === communityState.currentCommunityId,
      )?.community ?? null,
    [communityState.currentCommunityId, communityState.joinedCommunities],
  );

  const posts = usePosts(
    session?.access_token,
    {
      scope: tab,
      communityId: currentCommunity?.community_id,
      limit: 20,
    },
    Boolean(session) && (tab === 'public' || Boolean(currentCommunity)),
  );
  const p2pSync = useCommunityP2PSync(session?.access_token, currentCommunity?.community_id ?? null);
  const showMdnsDemoToggle = isP2PDevDemoVisible();

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleCommunity')} \u2014 WeaveNYC`;
  }, [t]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncOnlineState = () => {
      setIsOnline(window.navigator.onLine);
    };

    syncOnlineState();
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);

    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!currentCommunity || !p2pSync.status.enabled) {
      setCachedPosts(null);
      return;
    }

    void (async () => {
      const nextCache = await loadCachedPosts(currentCommunity.community_id, tab);
      if (!cancelled) {
        setCachedPosts(nextCache);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentCommunity, p2pSync.status.enabled, p2pSync.status.lastSyncAt, tab]);

  useEffect(() => {
    if (!currentCommunity || !posts.data || !p2pSync.status.enabled) {
      return;
    }

    const nextCache: CachedPostsValue = {
      communityId: currentCommunity.community_id,
      scope: tab,
      items: posts.data.items,
      next_cursor: posts.data.next_cursor,
      updatedAt: new Date().toISOString(),
      source: 'network',
    };

    setCachedPosts(nextCache);
    void saveCachedPosts(nextCache);
  }, [currentCommunity, p2pSync.status.enabled, posts.data, tab]);

  // P6 UX finding 2 (addendum). Fire a short live-region toast when the
  // phase flips to `ready` from a non-ready state. Screen readers hear
  // "Posts are up to date" and the toast also appears visually so
  // sighted users get the same affordance. We keep the timer short (2s)
  // so the toast doesn't linger on routine syncs.
  useEffect(() => {
    const phase = p2pSync.status.phase;
    const previous = previousPhaseRef.current;
    if (
      previous &&
      previous !== 'ready' &&
      previous !== 'disabled' &&
      phase === 'ready'
    ) {
      setShowReadyToast(true);
      const id = window.setTimeout(() => {
        setShowReadyToast(false);
      }, 2000);
      previousPhaseRef.current = phase;
      return () => {
        window.clearTimeout(id);
      };
    }
    previousPhaseRef.current = phase;
    return;
  }, [p2pSync.status.phase]);

  // Tombstones live in the cache for version comparison but must never reach
  // the user feed (see persistence.ts `filterVisiblePostsForScope`). Network
  // responses are already tombstone-free server-side.
  const cachedVisiblePosts = useMemo(
    () => filterVisiblePostsForScope(cachedPosts?.items, tab),
    [cachedPosts?.items, tab],
  );
  const usingCachedPosts = Boolean(
    p2pSync.status.enabled &&
      currentCommunity &&
      cachedPosts &&
      cachedVisiblePosts.length > 0 &&
      (!isOnline || posts.isError),
  );
  const visiblePosts = usingCachedPosts ? cachedVisiblePosts : posts.data?.items ?? [];

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      dispatch(setSession(await createAnonymousSession()));
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <div className="page-content" data-screen="community">
      <TopBar
        variant="page"
        eyebrow={t('pageTitleCommunity')}
        title={t('communityTitle')}
        backHref="/"
      />

      <Stack gap={5} as="section">
        {/* Anonymous visitor needs a session before we can show any
            community-scoped content. We preserve the `create-session`
            testid so the existing E2E flow on /community/join (which
            reaches this branch when the user lands here first) keeps
            working. */}
        {!session ? (
          <Card variant="raised">
            <Stack gap={3}>
              <Stack gap={1}>
                <span className="overline">{t('sessionAnonymous')}</span>
                <h2>{t('joinNeedsSession')}</h2>
              </Stack>
              <Inline gap={3} wrap>
                <Button
                  variant="primary"
                  size="md"
                  data-testid="create-session"
                  disabled={isCreatingSession}
                  loading={isCreatingSession}
                  onClick={() => void handleCreateSession()}
                >
                  {isCreatingSession ? t('creatingSession') : t('createSession')}
                </Button>
              </Inline>
            </Stack>
          </Card>
        ) : null}

        {/* Hero surface: either "join a community" empty state, or the
            current-community summary card. Both paths carry the
            `join-community` E2E testid — the empty state attaches it to
            the primary CTA, the summary card keeps it on the top-bar
            level action so returning users can still switch communities. */}
        {currentCommunity ? (
          <Card variant="accent" aria-labelledby="community-hero-title">
            <Stack gap={4}>
              <Stack gap={2}>
                <Inline gap={2} wrap>
                  <Tag tone="community" icon={<Icon name="chat" size="sm" />}>
                    {t('communityTab')}
                  </Tag>
                </Inline>
                <Stack gap={1}>
                  <h2 id="community-hero-title">
                    {/* Hero greeting surfaces the community name without
                        duplicating the "Current community:" overline — that
                        literal still appears in the feed subtitle below
                        (line ~444) so the `multi-community.spec.ts` /
                        `community-posts.spec.ts` regex still matches. */}
                    {t('communityHeroGreeting', { name: currentCommunity.name })}
                  </h2>
                </Stack>
                <p className="muted">{t('zipChip', { zip: currentCommunity.center_zip })}</p>
              </Stack>

              <Inline gap={3} wrap>
                <Button
                  as="a"
                  variant="primary"
                  size="md"
                  data-testid="join-community"
                  href="/community/join/"
                >
                  {t('joinCommunityCta')}
                </Button>
                <Button
                  as="a"
                  variant="secondary"
                  size="md"
                  data-testid="request-help"
                  href="/posts/new/?post_type=request"
                >
                  {t('requestHelpCta')}
                </Button>
                <Button
                  as="a"
                  variant="secondary"
                  size="md"
                  data-testid="offer-help"
                  href="/posts/new/?post_type=offer"
                >
                  {t('offerHelpCta')}
                </Button>
                <Button as="a" variant="ghost" size="md" href="/posts/mine/">
                  {t('myPostsTitle')}
                </Button>
                <ContactInboxLink />
              </Inline>
            </Stack>
          </Card>
        ) : (
          <Card variant="flat">
            <EmptyState
              illustrationName="matches-empty"
              title={t('communityTitle')}
              subtitle={t('communityNoMembership')}
              cta={{
                label: t('joinCommunityCta'),
                href: '/community/join',
                variant: 'primary',
                testId: 'join-community',
              }}
            />
            <Inline gap={3} wrap justify="center">
              <Button
                as="a"
                variant="secondary"
                size="md"
                data-testid="request-help"
                href="/posts/new/?post_type=request"
              >
                {t('requestHelpCta')}
              </Button>
              <Button
                as="a"
                variant="secondary"
                size="md"
                data-testid="offer-help"
                href="/posts/new/?post_type=offer"
              >
                {t('offerHelpCta')}
              </Button>
            </Inline>
          </Card>
        )}

        {/* Community switcher: only meaningful when the user belongs to
            more than one community. Single-membership users never see
            this row. */}
        {communityState.joinedCommunities.length > 1 ? (
          <Card variant="flat">
            <Stack gap={2}>
              <span className="overline">{t('currentCommunityLabel')}</span>
              <Inline gap={2} wrap>
                {communityState.joinedCommunities.map((item) => (
                  <Pill
                    key={item.community.community_id}
                    active={communityState.currentCommunityId === item.community.community_id}
                    onClick={() => dispatch(setCurrentCommunity(item.community.community_id))}
                  >
                    {item.community.name}
                  </Pill>
                ))}
              </Inline>
            </Stack>
          </Card>
        ) : null}

        {/* P2P sync card — Wave 3B redesign keeps the surface but swaps the
            raw div grid for Stack/Inline so spacing lines up with the
            rest of the screen. All i18n keys + hook behavior unchanged. */}
        {currentCommunity ? (
          <Card variant="raised" aria-labelledby="p2p-sync-title">
            <Stack gap={4}>
              <Inline gap={3} align="start" justify="between" wrap>
                <Stack gap={1}>
                  <h2 id="p2p-sync-title">{t('p2pSyncTitle')}</h2>
                  <p className="muted">
                    {t('p2pSyncCopy', { communityName: currentCommunity.name })}
                  </p>
                </Stack>
                {/* Phase chip lives inside a live region so screen readers
                    announce state transitions. `assertive` for
                    offline/degraded/auth_required/forbidden (the user needs
                    to act), `polite` for the connecting→ready path. */}
                <div
                  role="status"
                  aria-live={ASSERTIVE_PHASES.has(p2pSync.status.phase) ? 'assertive' : 'polite'}
                  aria-atomic="true"
                >
                  <Tag tone={P2P_PHASE_TONE[p2pSync.status.phase] ?? 'neutral'}>
                    {/* TODO(ux-pr): add localised strings for
                        p2pPhase_auth_required / p2pPhase_forbidden — for now
                        we fall back to the generic offline label so there's
                        no missing-key runtime warning. Gated on the UX PR
                        adding new i18n keys. */}
                    {p2pSync.status.phase === 'auth_required' || p2pSync.status.phase === 'forbidden'
                      ? t('p2pPhase_offline')
                      : t(`p2pPhase_${p2pSync.status.phase}`)}
                  </Tag>
                </div>
              </Inline>

              {/* W3 review M2: semantic <dl> so label/value pairs carry the
                  relationship in markup (screen readers announce each row as
                  "term: description"). The previous raw div+span+strong
                  structure rendered the same visual but lost the semantics. */}
              <dl className="metric-list">
                <div className="metric-list__row">
                  <dt>{t('p2pTransportLabel')}</dt>
                  <dd>
                    {p2pSync.status.transportLabel === 'mdns-demo'
                      ? t('p2pTransportMdnsDemo')
                      : t('p2pTransportBootstrap')}
                  </dd>
                </div>
                <div className="metric-list__row">
                  <dt>{t('p2pPeerCountLabel')}</dt>
                  <dd>{t('p2pPeerCountValue', { count: p2pSync.status.peerCount })}</dd>
                </div>
                <div className="metric-list__row">
                  <dt>{t('p2pLastSyncLabel')}</dt>
                  <dd>
                    {p2pSync.status.lastSyncAt
                      ? new Date(p2pSync.status.lastSyncAt).toLocaleString()
                      : t('p2pNoSyncYet')}
                  </dd>
                </div>
                <div className="metric-list__row">
                  <dt>{t('p2pPeerIdLabel')}</dt>
                  <dd className="metric-list__value--mono">
                    {p2pSync.status.peerId ?? t('p2pPeerIdPending')}
                  </dd>
                </div>
              </dl>

              {/* Error banner paired with the phase chip above under the same
                  live region semantics so SR users hear the error when the
                  phase flips.
                  P6 UX findings 3 + 10: surface a retry action (auth errors
                  route to /verify, everything else calls syncNow) and map
                  the worker's English `lastError` onto a localized string
                  keyed by `errorCategory`. The raw `lastError` is kept as
                  a small muted footnote so on-call can spot-check which
                  worker message triggered the banner. */}
              <div
                role="status"
                aria-live={ASSERTIVE_PHASES.has(p2pSync.status.phase) ? 'assertive' : 'polite'}
                aria-atomic="true"
              >
                {p2pSync.status.lastError ? (
                  (() => {
                    const isAuth =
                      p2pSync.status.errorCategory === 'auth' ||
                      p2pSync.status.phase === 'auth_required';
                    const errorKey = resolveP2PErrorKey(
                      p2pSync.status.phase,
                      p2pSync.status.errorCategory ?? null,
                    );
                    return (
                      <Banner
                        tone="danger"
                        title={t(errorKey)}
                        data-testid="p2p-error-banner"
                        actionLabel={
                          isAuth
                            ? t('p2pRetrySignInAction')
                            : t('p2pRetrySyncAction')
                        }
                        onAction={() => {
                          if (isAuth) {
                            router.push('/verify?return_to=/community/');
                            return;
                          }
                          p2pSync.syncNow();
                        }}
                      >
                        <span
                          className="muted p2p-error-debug"
                          data-testid="p2p-error-debug-detail"
                          aria-label={p2pSync.status.lastError}
                        >
                          {p2pSync.status.lastError}
                        </span>
                      </Banner>
                    );
                  })()
                ) : null}

                {!isOnline ? <Banner tone="warning" title={t('p2pOfflineMode')} /> : null}
              </div>

              <Inline gap={3} wrap>
                <Button
                  variant="primary"
                  size="md"
                  disabled={!session}
                  onClick={() => {
                    if (p2pSync.status.enabled) {
                      p2pSync.disable();
                      return;
                    }
                    p2pSync.enable();
                  }}
                >
                  {p2pSync.status.enabled ? t('p2pDisableAction') : t('p2pEnableAction')}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={!session?.access_token || !p2pSync.status.enabled}
                  onClick={() => p2pSync.syncNow()}
                >
                  {t('p2pSyncNowAction')}
                </Button>
              </Inline>

              {showMdnsDemoToggle ? (
                <Checkbox
                  label={t('p2pMdnsToggle')}
                  hint={t('p2pMdnsToggleCopy')}
                  checked={p2pSync.status.mdnsDemoEnabled}
                  onChange={(event) => p2pSync.setMdnsDemoEnabled(event.target.checked)}
                />
              ) : null}
            </Stack>
          </Card>
        ) : null}

        <CommunityAnnouncements
          accessToken={session?.access_token}
          p2pEnabled={p2pSync.status.enabled}
          cacheSignal={p2pSync.status.lastSyncAt}
          communityId={currentCommunity?.community_id ?? null}
          communityName={currentCommunity?.name ?? null}
          isOnline={isOnline}
          language={preferences.language}
        />

        <Card variant="raised" aria-labelledby="community-feed-title">
          <Stack gap={4}>
            <Stack gap={1}>
              <span className="overline">{t('communityFeedHeading')}</span>
              <h2 id="community-feed-title">{t('communityFeedHeading')}</h2>
              <p className="muted">
                {currentCommunity
                  ? `${t('currentCommunityLabel')}: ${currentCommunity.name}`
                  : t('communityNoMembership')}
              </p>
            </Stack>

            <Inline gap={2} wrap>
              <Pill
                active={tab === 'community'}
                data-testid="community-tab"
                onClick={() => setTab('community')}
              >
                {t('communityTab')}
              </Pill>
              <Pill
                active={tab === 'public'}
                data-testid="public-tab"
                onClick={() => setTab('public')}
              >
                {t('publicTab')}
              </Pill>
            </Inline>

            {tab === 'community' && !currentCommunity ? (
              <EmptyState
                illustrationName="matches-empty"
                title={t('communityNoMembership')}
                cta={{
                  label: t('joinCommunityCta'),
                  href: '/community/join',
                  variant: 'primary',
                }}
              />
            ) : null}

            {usingCachedPosts && cachedPosts ? (
              <Banner tone="info" title={t('p2pCacheBadge')}>
                {t('postsOfflineFallback', {
                  updatedAt: new Date(cachedPosts.updatedAt).toLocaleString(),
                })}
              </Banner>
            ) : null}

            {/* W3 review M1: three stacked skeleton rows replace the lone
                `status-copy` paragraph so the loading state matches what
                Home / Matches render. `aria-busy` + `aria-label` put the
                live-region semantics on the wrapper, and the child
                Skeletons are decorative (no per-row a11y noise). */}
            {posts.isLoading ? (
              <Stack
                gap={3}
                aria-busy="true"
                aria-label={t('postsLoading')}
                data-testid="posts-loading"
              >
                <Skeleton variant="rect" height={56} />
                <Skeleton variant="rect" height={56} />
                <Skeleton variant="rect" height={56} />
              </Stack>
            ) : null}

            {posts.isError ? (
              <Banner tone="danger" title={t('resourceLoadError')}>
                {usingCachedPosts
                  ? t('p2pLiveRefreshDelayed')
                  : posts.error instanceof Error
                    ? posts.error.message
                    : null}
              </Banner>
            ) : null}

            {visiblePosts.length === 0 && !posts.isLoading ? (
              <EmptyState
                illustrationName="posts-empty"
                title={t('postsEmpty')}
                cta={{
                  label: t('requestHelpCta'),
                  href: '/posts/new?post_type=request',
                  variant: 'secondary',
                }}
              />
            ) : null}

            {visiblePosts.length > 0 ? (
              <div className="resource-grid">
                {visiblePosts.map((post) => (
                  <PostCard
                    href={`/posts/${post.post_id}`}
                    key={post.post_id}
                    language={preferences.language}
                    post={post}
                  />
                ))}
              </div>
            ) : null}
          </Stack>
        </Card>

        {/* P6 UX finding 2 addendum — transient ~2s toast when sync flips
            from connecting/degraded back to ready. Toast's role=status +
            aria-live=polite gets the announcement to AT, and the visual
            chip gives sighted users the same cue. `onDismiss` lets a
            user close it early with the ✕ button if they want. */}
        {showReadyToast ? (
          <Toast
            tone="success"
            title={t('p2pStatusLiveUpdate')}
            data-testid="p2p-status-live-update"
            dismissLabel={t('buttonClose')}
            onDismiss={() => setShowReadyToast(false)}
          />
        ) : null}
      </Stack>
    </div>
  );
}
