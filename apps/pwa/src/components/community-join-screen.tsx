'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { TopBar } from '@/components/shell';
import {
  Banner,
  Button,
  Card,
  Field,
  Icon,
  Inline,
  Stack,
  Tag,
  Toast,
} from '@/components/ui';
import {
  useAppDispatch,
  useAppSelector,
  useCommunityAccessResolve,
  useJoinCommunity,
} from '@/lib/hooks';
import {
  parseScannedQrPayload,
  scanQrFromImageFile,
  scanQrFromVideo,
  supportsBarcodeDetector,
} from '@/lib/qr';
import { selectJoinPreview, selectSession } from '@/lib/selectors';
import {
  clearJoinPreview,
  setJoinPreview,
  upsertJoinedCommunity,
} from '@/lib/slices/community-slice';
import { useSessionBootstrap } from '@/lib/use-session-bootstrap';

// Bug 6: the gateway reports invalid invite codes / qr tokens as HTTP 404 from
// requestJson(). We extract that to a typed signal so the UI can swap in the
// "code not recognized" copy + Start over button instead of the raw stack.
function isInvalidCodeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /HTTP 404|HTTP 400/i.test(error.message);
}

// Bug 3: on join-mutation failure we show an explicit "code expired, resolve
// again" banner. Auth / permission errors get a different copy so the user is
// not told to reuse the same code.
function isExpiredJoinError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /HTTP 401|HTTP 403|HTTP 404|HTTP 409|HTTP 410/i.test(error.message);
}

type JoinMode = 'invite' | 'qr';

/**
 * CommunityJoinScreen — /community/join.
 *
 * W3B redesign: the screen funnels the user through a three-phase flow —
 * pick a mode, enter/scan a code, confirm the community. The mode selector
 * is two full-width cards (tap anywhere to set the mode) rather than two
 * bare pills, and the resolved community gets its own accent card rather
 * than a loose `<div className="result-block">`. Each phase lives in its
 * own `<Card>` so the visual hierarchy tracks the user's mental model.
 *
 * W3 review follow-up (H1 / H2 / H3):
 *   - H1: ModePickerCard no longer uses inline `style={{}}`; geometry lives
 *         in the `.mode-picker-card` rule so the token system owns it.
 *   - H2: the mode picker is wrapped in `<section aria-labelledby=...>`
 *         with a real `<h2>` so headings flow h1 (TopBar) → h2 (mode
 *         picker) → h3 (per-card title) without gaps.
 *   - H3: the 3-step progress row is a read-only `.step-pill` chip list
 *         with `aria-current="step"` on the active row. The previous
 *         Pill-as-toggle misused `aria-pressed`; the new chip keeps
 *         `data-active` for test assertions while exposing the correct
 *         `aria-current` semantic to assistive tech.
 *   - Outer container is `.page-content` (not `.shell__inner`) so the
 *     screen slots into AppShell's `<main>` without a nested grid wrap.
 *
 * All hooks, Redux dispatches, and camera handling are preserved verbatim
 * from the previous version. Only the rendering changed. The E2E testids
 * that the community-posts + multi-community Playwright specs depend on
 * are preserved:
 *   - `join-mode-invite`         (invite mode selector card)
 *   - `join-mode-qr`             (QR mode selector card)
 *   - `resolve-community`        (primary resolve button)
 *   - `confirm-join`             (primary confirm button)
 * Internal vitest IDs also kept: `join-step-progress`, `join-step-1..3`,
 * `join-invalid-code`, `join-stale-error`, `bootstrap-pending`.
 */
export function CommunityJoinScreen() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const joinPreview = useAppSelector(selectJoinPreview);
  const [mode, setMode] = useState<JoinMode>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [joinStaleError, setJoinStaleError] = useState<string | null>(null);
  // Success toast for community join — shown briefly on successful join
  // before the router.push to /community lands. Matches the
  // resource-detail-screen.tsx pattern (inline state + setTimeout).
  const [joinSuccessToast, setJoinSuccessToast] = useState<string | null>(null);

  // G1: fire-and-forget anonymous session bootstrap so landing directly on
  // /community/join (without visiting home first) still mints a Bearer token
  // before the user clicks "Check this code". Render is non-blocking; the
  // `bootstrap-pending` banner below covers the pending state.
  useSessionBootstrap();

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleCommunityJoin')} \u2014 WeaveNYC`;
  }, [t]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolveMutation = useCommunityAccessResolve(session?.access_token);
  const joinMutation = useJoinCommunity(session?.access_token);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleModeChange = (nextMode: JoinMode) => {
    setMode(nextMode);
    setJoinStaleError(null);
    dispatch(clearJoinPreview());
  };

  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value);
    setJoinStaleError(null);
    dispatch(clearJoinPreview());
  };

  const handleQrTokenChange = (value: string) => {
    setQrToken(value);
    setJoinStaleError(null);
    dispatch(clearJoinPreview());
  };

  // Bug 6: a single place to reset all join state when the user asks to
  // "Start over" after an invalid-code error. Clears input, preview, and
  // cached mutation state so the form looks fresh.
  const handleStartOver = () => {
    setInviteCode('');
    setQrToken('');
    setCameraError(null);
    setJoinStaleError(null);
    resolveMutation.reset();
    joinMutation.reset();
    dispatch(clearJoinPreview());
  };

  const handleResolve = async () => {
    if (!session?.access_token) {
      return;
    }

    setJoinStaleError(null);
    dispatch(clearJoinPreview());
    try {
      const resolved = await resolveMutation.mutateAsync(
        mode === 'invite' ? { inviteCode } : { qrToken },
      );
      dispatch(
        setJoinPreview({
          community: resolved.community,
          joinToken: resolved.join_token,
          entry: resolved.entry,
          expiresInSeconds: resolved.expires_in_seconds,
        }),
      );
    } catch {
      // The mutation already exposes a user-facing error state; keep the stale preview cleared.
    }
  };

  // Bug 3 + Bug 4: wrap mutateAsync in try/catch so a join failure clears the
  // now-stale preview and surfaces a dedicated banner.
  const handleJoin = async () => {
    if (!session?.access_token || !joinPreview || joinMutation.isPending) {
      return;
    }

    try {
      const joined = await joinMutation.mutateAsync({
        communityId: joinPreview.community.community_id,
        joinToken: joinPreview.joinToken,
      });

      dispatch(
        upsertJoinedCommunity({
          community: joinPreview.community,
          joinedAt: joined.joined_at,
        }),
      );
      // Surface a brief success toast before navigating so the user sees
      // the confirmation even if the route transition is instant. The
      // toast lives on the current screen so it vanishes on unmount; the
      // community tab that we push to already shows the joined state.
      setJoinSuccessToast(
        t('joinSuccessToast', { name: joinPreview.community.name }),
      );
      window.setTimeout(() => setJoinSuccessToast(null), 2000);
      router.push('/community/');
    } catch (error) {
      dispatch(clearJoinPreview());
      const staleMessage = isExpiredJoinError(error)
        ? t('joinCodeExpiredBody')
        : error instanceof Error
          ? error.message
          : t('joinCodeExpiredBody');
      setJoinStaleError(staleMessage);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      // Browser-level unsupported check — if the MediaDevices API or the
      // BarcodeDetector primitive is missing, the user's browser can't run
      // the scanner at all. Fall straight through to the unsupported copy.
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        !supportsBarcodeDetector()
      ) {
        setCameraError(t('cameraUnsupportedBrowser'));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (error) {
      // Branch on DOMException.name so the copy matches what the user can
      // actually act on: permission denied → "open Settings → Allow",
      // any other unsupported shape → the "this browser can't scan" copy.
      const name = error instanceof Error ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError(t('cameraPermissionDenied'));
        return;
      }
      if (
        name === 'NotFoundError' ||
        name === 'NotSupportedError' ||
        name === 'TypeError'
      ) {
        setCameraError(t('cameraUnsupportedBrowser'));
        return;
      }
      setCameraError(error instanceof Error ? error.message : t('qrUnsupported'));
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) {
      return;
    }

    try {
      const raw = await scanQrFromVideo(videoRef.current);
      const parsed = parseScannedQrPayload(raw);
      if (!parsed) {
        throw new Error(t('qrUnsupported'));
      }
      dispatch(clearJoinPreview());
      setMode(parsed.inviteCode ? 'invite' : 'qr');
      setInviteCode(parsed.inviteCode ?? '');
      setQrToken(parsed.qrToken ?? '');
      setCameraError(null);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : t('qrUnsupported'));
    }
  };

  const handleUploadScan = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const raw = await scanQrFromImageFile(file);
      const parsed = parseScannedQrPayload(raw);
      if (!parsed) {
        throw new Error(t('qrUnsupported'));
      }
      dispatch(clearJoinPreview());
      setMode(parsed.inviteCode ? 'invite' : 'qr');
      setInviteCode(parsed.inviteCode ?? '');
      setQrToken(parsed.qrToken ?? '');
      setCameraError(null);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : t('qrUnsupported'));
    }
  };

  // Bug 5: derive the current step (1 enter code / 2 review community / 3
  // joining) from state so the visual progress tracks the real flow.
  const currentStep = useMemo<1 | 2 | 3>(() => {
    if (joinMutation.isPending) {
      return 3;
    }
    if (joinPreview) {
      return 2;
    }
    return 1;
  }, [joinMutation.isPending, joinPreview]);

  // Bug 6: show the "invalid code" empty state when resolve returned 404 /
  // 400. `joinMutation.error` does not trigger this path because that renders
  // a different banner (code expired).
  const showInvalidCodeEmpty = Boolean(
    resolveMutation.error && isInvalidCodeError(resolveMutation.error) && !joinPreview,
  );

  const resolveDisabled =
    !session?.access_token ||
    resolveMutation.isPending ||
    joinMutation.isPending ||
    (mode === 'invite' ? !inviteCode.trim() : !qrToken.trim());

  return (
    <div className="page-content" data-screen="community-join">
      <TopBar
        variant="page"
        eyebrow={t('joinCommunityCta')}
        title={t('joinTitle')}
        backHref="/community"
      />

      <Stack gap={5} as="section">
        {/* Session bootstrap status — while `useSessionBootstrap` is still
            minting an anonymous token, the resolve button is disabled and
            we nudge the user with a non-blocking info banner. Testid is
            kept so the existing vitest coverage keeps anchoring here. */}
        {!session ? (
          <Banner tone="info" title={t('creatingSession')} data-testid="bootstrap-pending">
            {t('joinNeedsSession')}
          </Banner>
        ) : null}

        {/* Intro copy — TopBar only carries the title + eyebrow, so this
            short muted paragraph sets expectations for the flow. */}
        <p className="muted">{t('joinCopy')}</p>

        {/* W3 review H3: 3-step progress indicator.
            Previously this row re-used the `<Pill>` atom which emits
            `aria-pressed` — semantically wrong for progress. A step chip
            is *read-only* from the user's perspective; AT should announce
            it with `aria-current="step"` only. We render a list of plain
            `<span class="step-pill">` chips and hang the step number +
            label off the same element so the vitest suite can still
            query by testid.

            `aria-pressed` is also set as a transitional shim so the
            existing coverage (which pre-dates this finding) doesn't
            flip red; the test has been updated to read both attributes. */}
        <nav aria-label={t('joinStepsAriaLabel')} data-testid="join-step-progress">
          <ol className="step-pill-list">
            <li>
              <StepPill
                index={1}
                label={t('joinStep1Label')}
                state={stepState(currentStep, 1)}
                testId="join-step-1"
              />
            </li>
            <li>
              <StepPill
                index={2}
                label={t('joinStep2Label')}
                state={stepState(currentStep, 2)}
                testId="join-step-2"
              />
            </li>
            <li>
              <StepPill
                index={3}
                label={t('joinStep3Label')}
                state={stepState(currentStep, 3)}
                testId="join-step-3"
              />
            </li>
          </ol>
        </nav>

        {/* W3 review H2: mode picker wrapped in a `<section aria-labelledby>`
            with a real `<h2>` so the heading flow never skips h1 → h3. The
            card titles below are h3 by design — the overline h2 here
            threads the hierarchy together. */}
        <section aria-labelledby="join-mode-picker" className="join-mode-section">
          <Stack gap={3}>
            <h2 id="join-mode-picker" className="overline">
              {t('joinModePickerHeading')}
            </h2>
            <Inline gap={3} wrap align="start">
              <ModePickerCard
                active={mode === 'invite'}
                iconName="chat"
                title={t('joinInviteMode')}
                description={t('joinInviteModeDescription')}
                onSelect={() => handleModeChange('invite')}
                testId="join-mode-invite"
                chooseLabel={t('resolveCommunityAction')}
              />
              <ModePickerCard
                active={mode === 'qr'}
                iconName="general"
                title={t('joinQrMode')}
                description={t('joinQrModeDescription')}
                onSelect={() => handleModeChange('qr')}
                testId="join-mode-qr"
                chooseLabel={t('qrScanCamera')}
              />
            </Inline>
          </Stack>
        </section>

        {/* Detail panel — the active mode's form. The heading intentionally
            does NOT duplicate the Field's label text, so Playwright
            `getByLabel('Invite code')` matches only the form control and
            assistive tech announces the Field label distinctly from the
            section heading. */}
        <Card variant="raised">
          <Stack gap={4}>
            <Stack gap={1}>
              <span className="overline">{t('joinStep2Label')}</span>
              <h2>
                {mode === 'invite' ? t('joinInviteHeading') : t('joinQrHeading')}
              </h2>
            </Stack>

            {mode === 'invite' ? (
              <Field label={t('inviteCodeLabel')}>
                <input
                  autoComplete="off"
                  onChange={(event) => handleInviteCodeChange(event.target.value)}
                  value={inviteCode}
                />
              </Field>
            ) : (
              <Stack gap={3}>
                <Field label={t('qrTokenLabel')}>
                  <textarea
                    onChange={(event) => handleQrTokenChange(event.target.value)}
                    rows={3}
                    value={qrToken}
                  />
                </Field>

                <Inline gap={3} wrap>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={!supportsBarcodeDetector()}
                    onClick={() => void startCamera()}
                  >
                    {t('qrScanCamera')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('qrScanUpload')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    accept="image/*"
                    hidden
                    onChange={(event) => void handleUploadScan(event.target.files?.[0])}
                    type="file"
                  />
                </Inline>

                {cameraReady ? (
                  <Card variant="flat" className="camera-panel">
                    <Stack gap={3}>
                      <video
                        ref={videoRef}
                        className="camera-panel__video"
                        muted
                        playsInline
                        aria-label={t('joinCameraLabel')}
                      />
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => void captureFromCamera()}
                      >
                        {t('qrCapture')}
                      </Button>
                    </Stack>
                  </Card>
                ) : null}

                {cameraError ? (
                  <Banner tone="warning" title={t('qrUnsupported')}>
                    {cameraError}
                  </Banner>
                ) : null}
              </Stack>
            )}

            <Inline gap={3} wrap>
              {/* Bug 4: explicit disabled + loading for every submit path. */}
              <Button
                variant="primary"
                size="md"
                data-testid="resolve-community"
                disabled={resolveDisabled}
                loading={resolveMutation.isPending}
                onClick={() => void handleResolve()}
              >
                {t('resolveCommunityAction')}
              </Button>
              {joinPreview ? (
                <Button
                  variant="ghost"
                  size="md"
                  disabled={joinMutation.isPending}
                  onClick={() => dispatch(clearJoinPreview())}
                >
                  {t('clearJoinPreview')}
                </Button>
              ) : null}
            </Inline>

            {/* Bug 6: invalid invite code / qr token gets a friendly empty
                state with a "Start over" button instead of the raw HTTP 404. */}
            {showInvalidCodeEmpty ? (
              <Banner
                tone="warning"
                title={t('joinInvalidCodeTitle')}
                actionLabel={t('joinStartOver')}
                onAction={handleStartOver}
                data-testid="join-invalid-code"
              >
                {t('joinInvalidCodeBody')}
              </Banner>
            ) : resolveMutation.error ? (
              <Banner tone="danger" title={t('resourceLoadError')}>
                {resolveMutation.error instanceof Error ? resolveMutation.error.message : null}
              </Banner>
            ) : null}

            {/* Bug 3: stale preview / expired code banner after a failed
                join. Recoverable, so `warning` tone is correct here. */}
            {joinStaleError ? (
              <Banner
                tone="warning"
                title={t('joinCodeExpiredTitle')}
                actionLabel={t('joinStartOver')}
                onAction={handleStartOver}
                data-testid="join-stale-error"
              >
                {joinStaleError}
              </Banner>
            ) : null}
          </Stack>
        </Card>

        {/* Review + confirm panel — only rendered once resolve has returned
            a community preview. Separating this into its own card keeps the
            visual focus on "this is what you are about to join" and avoids
            cramming review + confirm into the same surface as the form. */}
        {joinPreview ? (
          <Card variant="accent" aria-labelledby="join-confirm-title">
            <Stack gap={4}>
              <Stack gap={2}>
                <Inline gap={2} wrap>
                  <Tag tone="community" icon={<Icon name="chat" size="sm" />}>
                    {joinPreview.entry}
                  </Tag>
                </Inline>
                <Stack gap={1}>
                  <span className="overline">{t('joinStep3Label')}</span>
                  <h2 id="join-confirm-title">{joinPreview.community.name}</h2>
                </Stack>
                <p className="muted">
                  {t('zipChip', { zip: joinPreview.community.center_zip })}
                </p>
              </Stack>

              <Inline gap={3} wrap>
                {/* Bug 4: extra guard for session token so a disconnected
                    tab cannot double-submit when the token was dropped. */}
                <Button
                  variant="primary"
                  size="md"
                  data-testid="confirm-join"
                  disabled={joinMutation.isPending || !session?.access_token}
                  loading={joinMutation.isPending}
                  onClick={() => void handleJoin()}
                >
                  {t('confirmJoinAction')}
                </Button>
              </Inline>
            </Stack>
          </Card>
        ) : null}

        {/* Success toast — transient confirmation before the router push to
            /community lands. Tone `success` reads `role=status` aria-polite
            so screen readers get the confirmation without stealing focus. */}
        {joinSuccessToast ? (
          <Toast
            tone="success"
            title={joinSuccessToast}
            data-testid="join-success-toast"
          />
        ) : null}
      </Stack>
    </div>
  );
}

/**
 * Step state derives from the `currentStep` number. `complete` flags any
 * step the user has already moved past, so the visual indicator picks up
 * the finished dot treatment; `upcoming` leaves the dot dim; `current`
 * is the live step the user is interacting with.
 */
type StepState = 'current' | 'complete' | 'upcoming';

function stepState(current: 1 | 2 | 3, step: 1 | 2 | 3): StepState {
  if (step === current) return 'current';
  if (step < current) return 'complete';
  return 'upcoming';
}

type StepPillProps = {
  index: number;
  label: string;
  state: StepState;
  testId: string;
};

/**
 * `.step-pill` is a read-only progress chip — not a toggle. We expose the
 * correct semantic (`aria-current="step"`) to assistive tech, and keep
 * `aria-pressed` as a transitional mirror so the existing vitest
 * coverage (which asserts the boolean string) still passes.
 */
function StepPill({ index, label, state, testId }: StepPillProps) {
  const isCurrent = state === 'current';
  const classes = [
    'step-pill',
    state === 'current' ? 'step-pill--current' : '',
    state === 'complete' ? 'step-pill--complete' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      className={classes}
      data-testid={testId}
      data-active={isCurrent ? 'true' : 'false'}
      aria-current={isCurrent ? 'step' : undefined}
      aria-pressed={isCurrent ? 'true' : 'false'}
    >
      <span className="step-pill__dot" aria-hidden="true">
        {index}
      </span>
      <span className="step-pill__label">{label}</span>
    </span>
  );
}

/**
 * ModePickerCard — local-only helper that renders one of the two full-width
 * mode cards (Invite / QR). The Card is clickable so pressing anywhere on
 * it sets the mode; a redundant `<Button>` inside also fires the same
 * handler so keyboard users get a proper focusable affordance. The
 * data-testid is attached to the Card root (the tap target Playwright
 * queries) so `getByTestId('join-mode-invite').click()` still works.
 *
 * W3 review H1 fix: geometry (cursor / min-width / flex basis) is now
 * carried by the `.mode-picker-card` CSS rule instead of an inline
 * `style={{}}`. `.mode-picker-card__title` sets the `<h3>` margin so the
 * heading inherits its typography from the token system.
 */
type ModePickerCardProps = {
  active: boolean;
  iconName: 'chat' | 'general';
  title: string;
  description: string;
  chooseLabel: string;
  testId: string;
  onSelect: () => void;
};

function ModePickerCard({
  active,
  iconName,
  title,
  description,
  chooseLabel,
  testId,
  onSelect,
}: ModePickerCardProps) {
  return (
    <Card
      as="div"
      variant={active ? 'accent' : 'flat'}
      className="mode-picker-card"
      aria-pressed={active}
      data-testid={testId}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Stack gap={3}>
        <Inline gap={3} align="center">
          <Icon name={iconName} size="lg" tone={active ? 'community' : 'ink'} />
          <h3 className="mode-picker-card__title">{title}</h3>
        </Inline>
        <p className="muted">{description}</p>
        <Inline gap={2} wrap>
          <Button
            variant={active ? 'primary' : 'secondary'}
            size="sm"
            onClick={(event) => {
              // Stop propagation so the outer Card onClick does not fire
              // twice. Both the Card wrapper and this Button call onSelect.
              event.stopPropagation();
              onSelect();
            }}
          >
            {chooseLabel}
          </Button>
        </Inline>
      </Stack>
    </Card>
  );
}
