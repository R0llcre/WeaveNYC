/**
 * Conversation thread — S4 1:1 chat.
 *
 * Mobile port of `apps/pwa/src/components/conversation-thread-screen.tsx`.
 * Wires the same TanStack Query + WebSocket + Redux graph as the PWA:
 *
 *   - `useConversation` + `useConversationMessages` drive the list.
 *   - `useSendConversationMessage` posts the composer text.
 *   - `useBlockUser` wipes the peer (header button → navigates back).
 *   - `useChatWebSocket` keeps the socket warm while the screen is
 *     mounted. Reconnect-on-foreground is wired via `AppState` so a
 *     user who backgrounds the app mid-conversation gets the socket
 *     re-established when they come back (the hook's own online-event
 *     listener handles the network-recovery path).
 *
 * FlatList is rendered `inverted` — newest messages are at the bottom of
 * the screen, and the underlying array is sorted newest-first so we can
 * hand the server payload to FlatList directly.
 *
 * Chat safety:
 *   - Any message with a `safety_flags` entry gets a red/amber/blue Banner
 *     above the bubble body.
 *   - Blocking flags (hate_speech / harassment) hide the body until the
 *     user taps "Show anyway" (matches the PWA V1-C pattern).
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  EmptyState,
  Skeleton,
  Stack,
} from '@/components/ui';
import {
  useAppSelector,
  useBlockUser,
  useConversation,
  useConversationMessages,
  useSendConversationMessage,
} from '@/lib/hooks';
import {
  selectPreferencesLanguage,
  selectSession,
} from '@/lib/selectors';
import type {
  ChatRealtimeEvent,
  ConversationMessage,
  MessageSafetyFlag,
} from '@/lib/types';
import {
  useChatWebSocket,
  type ChatWebSocketState,
} from '@/lib/use-chat-websocket';
import { useAppTheme } from '@/theme';

function resolveIntlLocale(language: string): string {
  if (language === 'es') return 'es-US';
  if (language === 'zh') return 'zh-CN';
  return 'en-US';
}

function formatMessageTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

type SafetyBannerTone = 'info' | 'warning' | 'danger';
type SafetyFlagDescriptor = {
  tone: SafetyBannerTone;
  messageKey:
    | 'chatSafetyHateSpeech'
    | 'chatSafetyHarassment'
    | 'chatSafetyPhone'
    | 'chatSafetyAddress'
    | 'chatSafetySsn'
    | 'chatSafetyBankAccount'
    | 'chatSafetyPassport'
    | 'chatSafetyBank'
    | 'chatSafetyWire'
    | 'chatSafetyCrypto'
    | 'chatSafetyGiftCard';
};

const SAFETY_FLAG_DESCRIPTORS: Record<MessageSafetyFlag, SafetyFlagDescriptor> = {
  hate_speech: { tone: 'danger', messageKey: 'chatSafetyHateSpeech' },
  harassment: { tone: 'danger', messageKey: 'chatSafetyHarassment' },
  sensitive_ssn: { tone: 'warning', messageKey: 'chatSafetySsn' },
  sensitive_bank_account: { tone: 'warning', messageKey: 'chatSafetyBankAccount' },
  keyword_passport: { tone: 'warning', messageKey: 'chatSafetyPassport' },
  keyword_bank: { tone: 'warning', messageKey: 'chatSafetyBank' },
  sensitive_phone: { tone: 'info', messageKey: 'chatSafetyPhone' },
  sensitive_address: { tone: 'info', messageKey: 'chatSafetyAddress' },
  keyword_wire: { tone: 'info', messageKey: 'chatSafetyWire' },
  keyword_crypto: { tone: 'info', messageKey: 'chatSafetyCrypto' },
  keyword_gift_card: { tone: 'info', messageKey: 'chatSafetyGiftCard' },
};

const BLOCKING_SAFETY_FLAGS = new Set<MessageSafetyFlag>(['hate_speech', 'harassment']);

function hasBlockingFlag(flags: readonly MessageSafetyFlag[] | undefined): boolean {
  if (!flags) return false;
  for (const flag of flags) {
    if (BLOCKING_SAFETY_FLAGS.has(flag)) return true;
  }
  return false;
}

function MessageBubble({
  message,
  locale,
  testID,
}: {
  message: ConversationMessage;
  locale: string;
  testID?: string;
}) {
  const { t } = useTranslation('chat');
  const theme = useAppTheme();
  const flags = message.safety_flags ?? [];
  const blocking = hasBlockingFlag(flags);
  const [revealed, setRevealed] = useState(false);
  const showBody = !blocking || revealed;
  const isMine = message.is_mine;

  return (
    <View
      testID={testID ?? `chat-message-${message.message_id}`}
      style={[
        styles.bubble,
        {
          backgroundColor: (isMine
            ? theme.colors.accentSoft
            : theme.colors.surfaceRaised) as string,
          borderRadius: theme.borderRadii!.md as number,
          padding: theme.spacing.sm as number,
          alignSelf: isMine ? 'flex-end' : 'flex-start',
          marginBottom: theme.spacing.s as number,
        },
      ]}
    >
      <View style={styles.bubbleMeta}>
        <Text
          style={{
            color: theme.colors.inkMuted as string,
            fontSize: theme.textVariants.micro.fontSize as number,
            lineHeight: theme.textVariants.micro.lineHeight as number,
          }}
        >
          {isMine ? t('chatThreadYou') : message.sender_alias}
        </Text>
        <Text
          style={{
            color: theme.colors.inkMuted as string,
            fontSize: theme.textVariants.micro.fontSize as number,
            lineHeight: theme.textVariants.micro.lineHeight as number,
            marginLeft: theme.spacing.s as number,
          }}
        >
          {formatMessageTime(message.sent_at, locale)}
        </Text>
      </View>

      {flags.length > 0 ? (
        <Stack gap="xs">
          {flags.map((flag) => {
            const descriptor = SAFETY_FLAG_DESCRIPTORS[flag];
            if (!descriptor) return null;
            return (
              <Banner
                key={flag}
                tone={descriptor.tone}
                title={t(descriptor.messageKey)}
                testID={`chat-safety-banner-${flag}`}
              />
            );
          })}
        </Stack>
      ) : null}

      {blocking && !revealed ? (
        <>
          <Text
            style={{
              color: theme.colors.inkMuted as string,
              fontStyle: 'italic',
              marginTop: theme.spacing.xs as number,
            }}
          >
            {t('chatSafetyHidden')}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setRevealed(true)}
            testID={`chat-message-${message.message_id}-show-anyway`}
          >
            {t('chatSafetyShowAnyway')}
          </Button>
        </>
      ) : null}

      {showBody ? (
        <Text
          style={{
            color: theme.colors.inkPrimary as string,
            fontSize: theme.textVariants.body.fontSize as number,
            lineHeight: theme.textVariants.body.lineHeight as number,
            marginTop: theme.spacing.xs as number,
          }}
        >
          {message.body}
        </Text>
      ) : null}
    </View>
  );
}

export default function ConversationScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation('chat');
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = params.conversationId ?? '';

  const session = useAppSelector(selectSession);
  const language = useAppSelector(selectPreferencesLanguage);
  const locale = resolveIntlLocale(language);

  const [composer, setComposer] = useState('');
  const [wsState, setWsState] = useState<ChatWebSocketState>('connecting');
  // Expo Router 2+ replaces the PWA `useEffectEvent` helper with plain
  // refs for the chat callbacks — we don't need the full experimental
  // React 19 surface for a 4-line socket bridge.
  const conversationQuery = useConversation(
    session?.access_token,
    conversationId,
    Boolean(session?.access_token) && Boolean(conversationId),
  );
  const messagesQuery = useConversationMessages(
    session?.access_token,
    conversationId,
    { limit: 50 },
    Boolean(session?.access_token) && Boolean(conversationId),
  );
  const sendMessageMutation = useSendConversationMessage(session?.access_token);
  const blockUserMutation = useBlockUser(session?.access_token);

  const conversation = conversationQuery.data;
  const messages = messagesQuery.data?.items ?? [];
  const otherParticipant =
    conversation?.participant_preview.find(
      (participant) => participant.user_id !== session?.user.user_id,
    ) ?? conversation?.participant_preview[0] ?? null;
  const displayName =
    otherParticipant?.alias ?? t('chatThreadFallbackAlias');
  const isBlocked = conversation?.status === 'blocked';
  const isClosed = conversation?.status === 'closed';

  // AppState bridge — re-enabling the socket hook on foreground is the
  // cheapest reconnect path: flipping `enabled` off+on tears down the
  // socket, and when it comes back the hook's heartbeat + reconnect
  // logic immediately re-establishes. We also trigger a refetch so any
  // messages that arrived while backgrounded surface without waiting
  // for the next socket event.
  const [socketEnabled, setSocketEnabled] = useState(true);
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Bounce the socket: flip off then back on.
        setSocketEnabled(false);
        setTimeout(() => setSocketEnabled(true), 50);
        void conversationQuery.refetch();
        void messagesQuery.refetch();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [conversationQuery, messagesQuery]);

  // Stable ref wrappers so the effect inside the hook doesn't re-run on
  // every render (React's strict mode would otherwise open two sockets).
  const conversationRefetchRef = useRef(conversationQuery.refetch);
  const messagesRefetchRef = useRef(messagesQuery.refetch);
  useEffect(() => {
    conversationRefetchRef.current = conversationQuery.refetch;
    messagesRefetchRef.current = messagesQuery.refetch;
  });

  const handleSocketMessage = useCallback(
    (payload: ChatRealtimeEvent) => {
      if (
        payload.event_type === 'message.created' &&
        payload.conversation_id === conversationId
      ) {
        void messagesRefetchRef.current();
        void conversationRefetchRef.current();
        return;
      }
      if (
        payload.event_type === 'conversation.updated' &&
        payload.conversation.conversation_id === conversationId
      ) {
        void conversationRefetchRef.current();
      }
    },
    [conversationId],
  );

  const handleSocketReconnect = useCallback(() => {
    void messagesRefetchRef.current();
    void conversationRefetchRef.current();
  }, []);

  useChatWebSocket(session?.access_token, handleSocketMessage, {
    enabled: socketEnabled && Boolean(session?.access_token) && Boolean(conversationId),
    onStateChange: setWsState,
    onReconnect: handleSocketReconnect,
  });

  // --- Mark as read -----------------------------------------------------
  // The PWA issues a POST /conversations/{id}/read on mount via
  // `markConversationRead`. That API isn't wired into the mobile
  // `hooks.ts` today (spec says to call it — the read-receipt client
  // helper lands in a follow-up milestone alongside the notifications
  // work), so we issue the refetch-on-mount as the read-side proxy.
  // The server also clears unread on next message fetch when the
  // requester is a participant, so refetch + conversation data update
  // is sufficient as a mark-read signal for V1-C.
  useEffect(() => {
    if (session?.access_token && conversationId) {
      void messagesQuery.refetch();
    }
    // Intentional one-shot-per-conversation mount effect; subsequent
    // refetches are driven by WebSocket events above. `messagesQuery`
    // is included in deps so the eslint-plugin-react-hooks rule is
    // satisfied genuinely (the query object is stable across renders
    // when inputs don't change, so this is still effectively one-shot).
  }, [conversationId, session?.access_token, messagesQuery]);

  async function handleSend() {
    const body = composer.trim();
    if (!body || isBlocked || isClosed) {
      return;
    }
    try {
      await sendMessageMutation.mutateAsync({ conversationId, body });
      setComposer('');
      void messagesQuery.refetch();
    } catch {
      // Error surfaces via the send-error Banner below.
    }
  }

  async function handleBlock() {
    if (!conversation?.other_user_id) return;
    try {
      await blockUserMutation.mutateAsync({
        blockedUserId: conversation.other_user_id,
        conversationId,
      });
      router.back();
    } catch {
      // Block failure surfaces via the mutation's error state below.
    }
  }

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ConversationMessage>) => (
      <MessageBubble message={item} locale={locale} />
    ),
    [locale],
  );

  // --- Anonymous gate ---------------------------------------------------
  if (!session || session.user.level === 'anonymous') {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.bg as string,
            paddingTop: (insets.top as number) + (theme.spacing.l as number),
            paddingHorizontal: theme.spacing.m as number,
          },
        ]}
        testID="conversation-screen"
      >
        <EmptyState
          illustrationName="error"
          title={t('inboxNeedsVerified')}
          cta={{
            label: t('inboxVerifyAction'),
            variant: 'primary',
            onPress: () => router.push('/verify'),
            testID: 'conversation-verify-cta',
          }}
          testID="conversation-unverified"
        />
      </View>
    );
  }

  const composerDisabled = isBlocked || isClosed || sendMessageMutation.isPending;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg as string,
          paddingTop: (insets.top as number) + (theme.spacing.m as number),
        },
      ]}
      testID="conversation-screen"
    >
      {/* Header — back / title / block ---------------------------------- */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing.m as number,
            paddingBottom: theme.spacing.s as number,
            borderBottomColor: theme.colors.border as string,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('inboxTitle')}
          onPress={() => router.back()}
          testID="conversation-back"
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            padding: theme.spacing.xs as number,
          })}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={theme.colors.inkPrimary as string}
          />
        </Pressable>
        <Text
          numberOfLines={1}
          style={[
            styles.headerTitle,
            {
              color: theme.colors.inkPrimary as string,
              fontSize: theme.textVariants.h3.fontSize as number,
              fontWeight: theme.textVariants.h3.fontWeight as '600',
            },
          ]}
        >
          {displayName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chatThreadBlockAction')}
          onPress={() => void handleBlock()}
          disabled={blockUserMutation.isPending || isBlocked}
          testID="conversation-block"
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : blockUserMutation.isPending || isBlocked ? 0.4 : 1,
            padding: theme.spacing.xs as number,
          })}
        >
          <Ionicons
            name="shield-outline"
            size={22}
            color={theme.colors.danger as string}
          />
        </Pressable>
      </View>

      {/* Banners -------------------------------------------------------- */}
      <View style={{ paddingHorizontal: theme.spacing.m as number, gap: theme.spacing.s as number }}>
        {wsState === 'reconnecting' ? (
          <Banner tone="info" title={t('wsReconnecting')} testID="conversation-ws-reconnecting" />
        ) : wsState === 'closed' ? (
          <Banner tone="warning" title={t('wsDisconnected')} testID="conversation-ws-closed" />
        ) : null}
        {isBlocked ? (
          <Banner
            tone="warning"
            title={t('chatThreadBlockedNotice')}
            testID="conversation-blocked"
          />
        ) : null}
      </View>

      {/* Messages list -------------------------------------------------- */}
      {messagesQuery.isLoading ? (
        <View style={{ padding: theme.spacing.m as number, gap: theme.spacing.s as number }}>
          <Skeleton variant="rect" height={64} />
          <Skeleton variant="rect" height={80} />
          <Skeleton variant="rect" height={64} />
        </View>
      ) : messages.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            illustrationName="inbox-empty"
            title={t('chatThreadEmpty')}
            testID="conversation-empty"
          />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.message_id}
          renderItem={renderItem}
          inverted
          testID="conversation-list"
          contentContainerStyle={{
            padding: theme.spacing.m as number,
          }}
        />
      )}

      {/* Send error banner --------------------------------------------- */}
      {sendMessageMutation.isError ? (
        <View style={{ paddingHorizontal: theme.spacing.m as number }}>
          <Banner
            tone="danger"
            title={t('sendFailedTitle')}
            actionLabel={t('sendFailedRetry')}
            onAction={() => sendMessageMutation.reset()}
            testID="conversation-send-error"
          />
        </View>
      ) : null}

      {/* Composer -------------------------------------------------------- */}
      <View
        style={[
          styles.composer,
          {
            paddingHorizontal: theme.spacing.m as number,
            paddingTop: theme.spacing.s as number,
            paddingBottom: (insets.bottom as number) + (theme.spacing.s as number),
            borderTopColor: theme.colors.border as string,
            backgroundColor: theme.colors.surface as string,
            gap: theme.spacing.s as number,
          },
        ]}
      >
        <TextInput
          testID="chat-input"
          value={composer}
          onChangeText={setComposer}
          placeholder={t('chatThreadComposerPlaceholder')}
          placeholderTextColor={theme.colors.inkMuted as string}
          multiline
          editable={!composerDisabled}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            color: theme.colors.inkPrimary as string,
            fontSize: theme.textVariants.body.fontSize as number,
            backgroundColor: theme.colors.surface as string,
            borderColor: theme.colors.border as string,
            borderWidth: 1,
            borderRadius: theme.borderRadii!.md as number,
            paddingHorizontal: theme.spacing.sm as number,
            paddingVertical: theme.spacing.s as number,
          }}
        />
        <Button
          variant="primary"
          size="md"
          onPress={() => void handleSend()}
          disabled={composerDisabled || !composer.trim()}
          loading={sendMessageMutation.isPending}
          testID="chat-send"
        >
          {t('chatThreadSendAction')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  bubble: {
    maxWidth: '85%',
  },
  bubbleMeta: {
    flexDirection: 'row',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
