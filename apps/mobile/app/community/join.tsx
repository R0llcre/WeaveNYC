/**
 * Community join — mobile port of
 * `apps/pwa/src/components/community-join-screen.tsx`.
 *
 * Two-path flow:
 *   1. **Invite code** — Field input → `useCommunityAccessResolve` on submit
 *      → shows a preview Card → "Join" CTA calls `useJoinCommunity`.
 *   2. **QR scan** — expo-camera `CameraView` with `onBarcodeScanned`;
 *      decoded payload feeds the same resolve mutation. First tap shows a
 *      permission primer Banner so users know why we ask for the camera.
 *
 * The PWA version uses the browser `BarcodeDetector` API + a WebRTC
 * `MediaStream`; native swaps both for expo-camera's single `CameraView`
 * component which handles permission + scanning in one primitive. The
 * `parseScannedQrPayload` helper from `qr.ts` is reused verbatim so the
 * QR payload schema stays identical across platforms.
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  Field,
  Inline,
  PageHeader,
  Pill,
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
import { parseScannedQrPayload } from '@/lib/qr';
import { selectJoinPreview, selectSession } from '@/lib/selectors';
import {
  clearJoinPreview,
  setJoinPreview,
  upsertJoinedCommunity,
  setCurrentCommunity,
} from '@/lib/slices/community-slice';
import { useAppTheme } from '@/theme';

type JoinMode = 'invite' | 'qr';

export default function CommunityJoinScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['community', 'chrome', 'errors']);

  const session = useAppSelector(selectSession);
  const joinPreview = useAppSelector(selectJoinPreview);

  const [mode, setMode] = useState<JoinMode>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const resolveMutation = useCommunityAccessResolve(session?.access_token);
  const joinMutation = useJoinCommunity(session?.access_token);

  const onModeChange = (next: JoinMode) => {
    setMode(next);
    setCameraError(null);
    dispatch(clearJoinPreview());
    setScanned(false);
  };

  // Adapter: the API result carries snake-cased fields (`join_token`,
  // `expires_in_seconds`) while the Redux `CommunityJoinPreview` type is
  // camelCase (matches the PWA slice contract). Reshape once at the
  // boundary so the rest of the screen can stay in camelCase land.
  const previewFromResult = (r: {
    community: { community_id: string; name: string; center_zip: string; join_policy: 'invite_only' | 'open' };
    join_token: string;
    entry: 'invite_code' | 'qr_token';
    expires_in_seconds: number;
  }) => ({
    community: r.community,
    joinToken: r.join_token,
    entry: r.entry,
    expiresInSeconds: r.expires_in_seconds,
  });

  const resolveInvite = async () => {
    const code = inviteCode.trim();
    if (!code) return;
    try {
      const result = await resolveMutation.mutateAsync({ inviteCode: code });
      dispatch(setJoinPreview(previewFromResult(result)));
    } catch (err) {
      setCameraError((err as Error)?.message ?? 'unknown');
    }
  };

  const onBarcodeScanned = async (scan: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const parsed = parseScannedQrPayload(scan.data);
      if (!parsed) {
        setCameraError(t('errors:errorUnknown', { defaultValue: 'Invalid QR' }));
        return;
      }
      // QR payload can carry either a qr_token or an invite code. The
      // `CommunityAccessResolveInput` is a discriminated union of one or
      // the other; pick the branch the payload actually has.
      const input = parsed.qrToken
        ? { qrToken: parsed.qrToken }
        : parsed.inviteCode
          ? { inviteCode: parsed.inviteCode }
          : null;
      if (!input) {
        setCameraError(t('errors:errorUnknown', { defaultValue: 'Invalid QR' }));
        return;
      }
      const resolved = await resolveMutation.mutateAsync(input);
      dispatch(setJoinPreview(previewFromResult(resolved)));
    } catch (err) {
      setCameraError((err as Error)?.message ?? 'unknown');
    }
  };

  const onConfirmJoin = async () => {
    if (!joinPreview) return;
    try {
      const result = await joinMutation.mutateAsync({
        communityId: joinPreview.community.community_id,
        joinToken: joinPreview.joinToken,
      });
      dispatch(
        upsertJoinedCommunity({
          community: joinPreview.community,
          joinedAt: result.joined_at,
        }),
      );
      dispatch(setCurrentCommunity(joinPreview.community.community_id));
      dispatch(clearJoinPreview());
      setToast(
        result.membership_status === 'already_joined'
          ? t('community:communityAlreadyJoined', { defaultValue: 'Already joined' })
          : t('community:communityJoinSuccess', { defaultValue: 'Joined' }),
      );
      setTimeout(() => router.replace('/community'), 500);
    } catch (err) {
      setCameraError((err as Error)?.message ?? 'unknown');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg as string }}
      contentContainerStyle={{
        paddingTop: (insets.top as number) + (theme.spacing.s as number),
        paddingBottom: (insets.bottom as number) + (theme.spacing.xl as number),
        paddingHorizontal: theme.spacing.l as number,
      }}
      testID="community-join-screen"
    >
      <PageHeader
        title={t('community:joinCommunityCta')}
        onBack={() => router.back()}
      />

      <Stack gap="l">
        <Inline gap="s">
          <Pill
            selected={mode === 'invite'}
            onPress={() => onModeChange('invite')}
            testID="join-mode-invite"
          >
            {t('community:joinInvite', { defaultValue: 'Invite code' })}
          </Pill>
          <Pill
            selected={mode === 'qr'}
            onPress={() => onModeChange('qr')}
            testID="join-mode-qr"
          >
            {t('community:joinQr', { defaultValue: 'Scan QR' })}
          </Pill>
        </Inline>

        {cameraError ? (
          <Banner tone="danger" title={t('errors:errorUnknown', { defaultValue: 'Error' })}>
            {cameraError}
          </Banner>
        ) : null}

        {mode === 'invite' ? (
          <Card padding="l" variant="elevated">
            <Stack gap="m">
              <Field
                label={t('community:joinInviteLabel', { defaultValue: 'Invite code' })}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="XXXX-XXXX"
                autoCapitalize="characters"
                testID="invite-code-field"
              />
              <Button
                variant="primary"
                onPress={resolveInvite}
                loading={resolveMutation.isPending}
                testID="resolve-community"
              >
                {t('community:joinInviteSubmit', { defaultValue: 'Check code' })}
              </Button>
            </Stack>
          </Card>
        ) : (
          <Card padding="l" variant="elevated">
            <Stack gap="m">
              <Banner
                tone="info"
                title={t('community:joinQrPrimer', {
                  defaultValue: 'Camera access',
                })}
              >
                {t('community:joinQrPrimerBody', {
                  defaultValue: 'WeaveNYC uses the camera only to read the QR on a community flier.',
                })}
              </Banner>
              {!permission ? (
                <Text style={{ color: theme.colors.inkMuted as string }}>
                  {t('community:joinQrPermissionLoading', { defaultValue: 'Checking permission…' })}
                </Text>
              ) : !permission.granted ? (
                <Button
                  variant="primary"
                  onPress={() => {
                    void requestPermission();
                  }}
                  testID="request-camera"
                >
                  {t('community:joinQrPermissionCta', { defaultValue: 'Allow camera' })}
                </Button>
              ) : (
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: theme.borderRadii!.md as number,
                    overflow: 'hidden',
                    backgroundColor: theme.colors.surfaceStrong as string,
                  }}
                  testID="qr-camera-viewport"
                >
                  <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
                  />
                </View>
              )}
            </Stack>
          </Card>
        )}

        {joinPreview ? (
          <Card padding="l" variant="elevated" testID="join-preview-card">
            <Stack gap="s">
              <Inline gap="s">
                <Tag tone="verified">{joinPreview.community.name}</Tag>
                <Tag tone="neutral">{joinPreview.community.center_zip}</Tag>
              </Inline>
              <Text
                style={{
                  color: theme.colors.inkSecondary as string,
                  fontSize: theme.textVariants.body.fontSize as number,
                  lineHeight: theme.textVariants.body.lineHeight as number,
                }}
              >
                {t('community:joinPreviewCopy', {
                  defaultValue: 'Confirm to join this community.',
                })}
              </Text>
              <Button
                variant="primary"
                size="lg"
                onPress={onConfirmJoin}
                loading={joinMutation.isPending}
                testID="confirm-join"
              >
                {t('community:joinCommunityCta')}
              </Button>
            </Stack>
          </Card>
        ) : null}
      </Stack>

      {toast ? (
        <Toast
          tone="success"
          message={toast}
          onDismiss={() => setToast(null)}
          dismissLabel={t('chrome:dismiss', { defaultValue: 'Dismiss' })}
        />
      ) : null}
    </ScrollView>
  );
}
