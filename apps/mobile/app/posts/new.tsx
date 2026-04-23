/**
 * Post composer — mobile port of
 * `apps/pwa/src/components/post-composer-screen.tsx`.
 *
 * Three-stage flow kept intact:
 *
 *   1. *Type* — tap "Ask for help" or "Offer help". Each is a full-width
 *      Card; the active one gets an accent border + Tag chip.
 *   2. *Compose* — category Pill row, Title Field, Details multi-line
 *      TextInput (RN doesn't auto-grow the way the web does — we pin
 *      `numberOfLines` + `multiline` instead). ZIP inherits from
 *      preferences.
 *   3. *Preview* — a read-only Card mirroring how a post renders on the
 *      community feed. The "Post" CTA calls `createPost` directly; on
 *      failure we enqueue the draft to the outbox via
 *      `enqueuePendingPost` and show a Toast so the user knows the draft
 *      is safe and will replay when connectivity returns.
 *
 * The server-side contract (`CreatePostInput`) is identical to the PWA,
 * so the retry / idempotency semantics the outbox drain relies on ship
 * unchanged here.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
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
import { createPost } from '@/lib/api';
import {
  useAppSelector,
} from '@/lib/hooks';
import { enqueuePendingPost } from '@/lib/persistence';
import {
  selectCommunity,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { useAppTheme } from '@/theme';
import type {
  CreatePostInput,
  PostCategory,
  PostType,
} from '@/lib/types';

const CATEGORIES: readonly PostCategory[] = [
  'food',
  'goods',
  'childcare',
  'translation',
  'transportation',
  'other',
] as const;

type Step = 'type' | 'compose' | 'preview';

// RN doesn't ship a `crypto.randomUUID` polyfill everywhere, but the
// outbox entry just needs a stable local id; a timestamp + random suffix
// is opaque enough and avoids adding another dep.
function localId(): string {
  return `local-${Date.now()}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export default function PostComposerScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation(['posts', 'community', 'chrome', 'errors']);

  const session = useAppSelector(selectSession);
  const preferences = useAppSelector(selectPreferences);
  const communityState = useAppSelector(selectCommunity);
  const currentCommunityId = communityState.currentCommunityId;

  const [step, setStep] = useState<Step>('type');
  const [postType, setPostType] = useState<PostType>('request');
  const [category, setCategory] = useState<PostCategory>('food');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'warning' | 'danger'>('success');
  const [error, setError] = useState<string | null>(null);

  const canAdvanceToCompose = true;
  const canAdvanceToPreview =
    title.trim().length > 0 && body.trim().length > 0 && title.length <= 140;

  const onPublish = async () => {
    setError(null);
    if (!session?.access_token) {
      setError(t('posts:composeNeedsVerified'));
      return;
    }
    if (!currentCommunityId) {
      setError(t('posts:composeNeedsCommunity'));
      return;
    }

    const payload: CreatePostInput = {
      communityId: currentCommunityId,
      postType,
      category,
      title: title.trim(),
      body: body.trim(),
      language: preferences.language,
      locationZip: preferences.zipCode ?? '10001',
      privacy: preferences.defaultPostVisibility ?? 'community_only',
      expiresAt: isoPlusDays(7),
      idempotencyKey: localId(),
    };

    setSubmitting(true);
    try {
      await createPost(session.access_token, payload);
      setToastTone('success');
      setToast(t('posts:composePublishedToast', { defaultValue: 'Posted' }));
      setTimeout(() => router.replace('/community'), 400);
    } catch (err) {
      // Network / server failure → enqueue offline. The outbox drain hook
      // (`use-outbox-drain.ts`) will replay once connectivity returns, and
      // the community feed shows a "saved — pending" chip for the row.
      try {
        await enqueuePendingPost({
          client_id: payload.idempotencyKey ?? localId(),
          created_at: new Date().toISOString(),
          attempt_count: 0,
          last_attempt_at: null,
          last_error: (err as Error)?.message ?? 'unknown',
          last_failure_permanent: false,
          payload,
          community_id: currentCommunityId,
        });
        setToastTone('warning');
        setToast(
          t('posts:composeOfflineToast', {
            defaultValue: 'Saved — will send when online',
          }),
        );
      } catch {
        setToastTone('danger');
        setToast((err as Error)?.message ?? 'Error');
      }
    } finally {
      setSubmitting(false);
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
      testID="post-composer-screen"
    >
      <PageHeader title={t('posts:composeTitle')} onBack={() => router.back()} />

      <Inline gap="xs">
        <Pill selected={step === 'type'}>{t('posts:composerStep1Label')}</Pill>
        <Pill selected={step === 'compose'}>{t('posts:composerStep2Label')}</Pill>
        <Pill selected={step === 'preview'}>{t('posts:composerStep3Label')}</Pill>
      </Inline>

      {error ? (
        <Banner
          tone="danger"
          title={t('errors:errorUnknown', { defaultValue: 'Error' })}
        >
          {error}
        </Banner>
      ) : null}

      {step === 'type' ? (
        <Stack gap="m">
          <Card padding="l" variant="elevated">
            <Stack gap="s">
              <Text
                style={{
                  color: theme.colors.inkPrimary as string,
                  fontSize: theme.textVariants.h3.fontSize as number,
                  lineHeight: theme.textVariants.h3.lineHeight as number,
                  fontWeight: '600',
                }}
              >
                {t('posts:composeStepType')}
              </Text>

              <Inline gap="s">
                <Pill
                  selected={postType === 'request'}
                  onPress={() => setPostType('request')}
                  testID="select-request"
                >
                  {t('posts:requestHelpCta')}
                </Pill>
                <Pill
                  selected={postType === 'offer'}
                  onPress={() => setPostType('offer')}
                  testID="select-offer"
                >
                  {t('posts:offerHelpCta')}
                </Pill>
              </Inline>
            </Stack>
          </Card>

          <Button
            variant="primary"
            onPress={() => setStep('compose')}
            disabled={!canAdvanceToCompose}
          >
            {t('posts:composeStep2')}
          </Button>
        </Stack>
      ) : step === 'compose' ? (
        <Stack gap="m">
          <Card padding="l" variant="elevated">
            <Stack gap="m">
              <Text
                style={{
                  color: theme.colors.inkPrimary as string,
                  fontSize: theme.textVariants.h3.fontSize as number,
                  lineHeight: theme.textVariants.h3.lineHeight as number,
                  fontWeight: '600',
                }}
              >
                {t('posts:composeStepCompose')}
              </Text>

              <Inline gap="xs">
                {CATEGORIES.map((c) => (
                  <Pill
                    key={c}
                    selected={category === c}
                    onPress={() => setCategory(c)}
                    testID={`category-${c}`}
                  >
                    {c}
                  </Pill>
                ))}
              </Inline>

              <Field
                label={t('posts:composeTitleLabel')}
                value={title}
                onChangeText={setTitle}
                placeholder=""
                testID="compose-title"
              />

              {/*
                The Field atom is single-line only (TextInput without
                `multiline` support on purpose — the M3b spec keeps the
                surface narrow). Post body needs a proper textarea, so we
                inline a TextInput here with explicit styling pulled from
                the same tokens Field uses. This is the only place in the
                composer that reaches past the atom boundary.
              */}
              <Stack gap="xs">
                <Text
                  style={{
                    color: theme.colors.inkSecondary as string,
                    fontSize: theme.textVariants.label.fontSize as number,
                    lineHeight: theme.textVariants.label.lineHeight as number,
                    fontWeight: '500',
                  }}
                >
                  {t('posts:composeBodyLabel')}
                </Text>
                <TextInput
                  testID="compose-body"
                  multiline
                  numberOfLines={6}
                  value={body}
                  onChangeText={setBody}
                  placeholderTextColor={theme.colors.inkMuted as string}
                  textAlignVertical="top"
                  style={[
                    styles.bodyInput,
                    {
                      color: theme.colors.inkPrimary as string,
                      backgroundColor: theme.colors.surface as string,
                      borderColor: theme.colors.border as string,
                      borderRadius: theme.borderRadii!.md as number,
                      paddingHorizontal: theme.spacing.sm as number,
                      paddingVertical: theme.spacing.s as number,
                      fontSize: theme.textVariants.body.fontSize as number,
                      lineHeight: theme.textVariants.body.lineHeight as number,
                    },
                  ]}
                />
              </Stack>
            </Stack>
          </Card>

          <Inline gap="s">
            <Button variant="ghost" onPress={() => setStep('type')}>
              {t('posts:composerBackToEdit')}
            </Button>
            <Button
              variant="primary"
              onPress={() => setStep('preview')}
              disabled={!canAdvanceToPreview}
              testID="compose-next"
            >
              {t('posts:composeStep3')}
            </Button>
          </Inline>
        </Stack>
      ) : (
        <Stack gap="m">
          <Card padding="l" variant="elevated" testID="preview-card">
            <Stack gap="s">
              <Inline gap="xs">
                <Tag tone={postType === 'request' ? 'urgent' : 'verified'}>
                  {postType}
                </Tag>
                <Tag tone="info">{category}</Tag>
              </Inline>
              <Text
                style={{
                  color: theme.colors.inkPrimary as string,
                  fontSize: theme.textVariants.h3.fontSize as number,
                  lineHeight: theme.textVariants.h3.lineHeight as number,
                  fontWeight: '600',
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  color: theme.colors.inkSecondary as string,
                  fontSize: theme.textVariants.body.fontSize as number,
                  lineHeight: theme.textVariants.body.lineHeight as number,
                }}
              >
                {body}
              </Text>
            </Stack>
          </Card>

          <Inline gap="s">
            <Button variant="ghost" onPress={() => setStep('compose')}>
              {t('posts:composerBackToEdit')}
            </Button>
            <Button
              variant="primary"
              onPress={onPublish}
              loading={submitting}
              testID="publish-post"
            >
              {t('posts:composePublishAction')}
            </Button>
          </Inline>
        </Stack>
      )}

      {toast ? (
        <Toast
          tone={toastTone}
          message={toast}
          onDismiss={() => setToast(null)}
          dismissLabel={t('chrome:dismiss', { defaultValue: 'Dismiss' })}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bodyInput: {
    borderWidth: 1,
    minHeight: 120,
  },
});
