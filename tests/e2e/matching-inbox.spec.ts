import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  user: {
    user_id: string;
    level: 'anonymous' | 'verified' | 'anchor';
  };
  issued_via?: string;
};

type ContactRequestRecord = {
  contact_request_id: string;
  from_post_id: string;
  to_post_id: string;
  requester_user_id: string;
  requester_alias: string;
  recipient_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  expires_at: string;
  responded_at?: string;
  conversation_id?: string;
};

const communityId = '44444444-4444-4444-8444-444444444444';
const requesterUserId = '11111111-1111-4111-8111-111111111111';
const recipientUserId = '22222222-2222-4222-8222-222222222222';
const requestPostId = '88888888-8888-4888-8888-888888888888';
const offerAId = '99999999-9999-4999-8999-999999999999';
const offerBId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const resourceId = '77777777-7777-4777-8777-777777777777';
const suggestionOneId = '10000000-0000-4000-8000-000000000001';
const suggestionTwoId = '10000000-0000-4000-8000-000000000002';
const suggestionThreeId = '10000000-0000-4000-8000-000000000003';
const suggestionFourId = '10000000-0000-4000-8000-000000000004';
const contactOneId = '20000000-0000-4000-8000-000000000001';
const contactTwoId = '20000000-0000-4000-8000-000000000002';
const generatedContactPrefix = '20000000-0000-4000-8000-';
const generatedConversationPrefix = '30000000-0000-4000-8000-';
const otpChallengeId = '40000000-0000-4000-8000-000000000001';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function nowIso(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
}

function createSharedState() {
  const requesterAnonymousSession: SessionPayload = {
    access_token: 'requester-anon-token',
    refresh_token: 'requester-anon-refresh',
    user: {
      user_id: requesterUserId,
      level: 'anonymous',
    },
    issued_via: 'anonymous',
  };

  const requesterVerifiedSession: SessionPayload = {
    access_token: 'requester-verified-token',
    refresh_token: 'requester-verified-refresh',
    user: {
      user_id: requesterUserId,
      level: 'verified',
    },
    issued_via: 'otp',
  };

  const recipientVerifiedSession: SessionPayload = {
    access_token: 'recipient-verified-token',
    refresh_token: 'recipient-verified-refresh',
    user: {
      user_id: recipientUserId,
      level: 'verified',
    },
    issued_via: 'otp',
  };

  const requestPost = {
    post_id: requestPostId,
    community_id: communityId,
    post_type: 'request',
    category: 'food',
    title: 'Need groceries tonight',
    body: 'Need help with groceries for dinner tonight.',
    language: 'en',
    location_zip: '11735',
    privacy: 'community_only',
    status: 'active',
    risk_level: 'low',
    created_at: nowIso(-20),
    updated_at: nowIso(-20),
    expires_at: nowIso(60 * 24),
    is_owner: true,
    contact_pref: {
      in_app_chat: true,
      call: false,
      text: false,
    },
    actions: {
      can_edit: true,
      can_close: true,
      can_delete: true,
      can_review: false,
    },
  } as const;

  const offerA = {
    post_id: offerAId,
    community_id: communityId,
    post_type: 'offer',
    category: 'food',
    title: 'Can share groceries tonight',
    body: 'Pickup available after 6pm.',
    language: 'en',
    location_zip: '11735',
    privacy: 'community_only',
    status: 'active',
    risk_level: 'low',
    created_at: nowIso(-30),
    updated_at: nowIso(-30),
    expires_at: nowIso(60 * 12),
    is_owner: false,
  } as const;

  const offerB = {
    post_id: offerBId,
    community_id: communityId,
    post_type: 'offer',
    category: 'food',
    title: 'Can share pantry staples',
    body: 'Available tomorrow morning.',
    language: 'es',
    location_zip: '11714',
    privacy: 'community_only',
    status: 'active',
    risk_level: 'low',
    created_at: nowIso(-10),
    updated_at: nowIso(-10),
    expires_at: nowIso(60 * 18),
    is_owner: false,
  } as const;

  const resource = {
    provider_id: resourceId,
    name: 'St. Kilian Parish Social Ministry',
    type: 'pantry',
    address: '140 Elizabeth Street, Farmingdale, NY 11735',
    city: 'Farmingdale',
    state: 'NY',
    zip: '11735',
    phone: '516-756-9656',
    languages: ['en', 'es'],
    source: 'cfc_active',
    source_label: 'NYC HRA Community Food Connection',
    notes: 'Call ahead for pantry hours.',
    distance_miles: 0.2,
    is_open_today: true,
    is_open_now: false,
    geo_precision: 'street',
    directions_url: 'https://maps.google.com/?q=140+Elizabeth+Street+Farmingdale+NY+11735',
  } as const;

  let refreshUsed = false;
  const contacts = new Map<string, ContactRequestRecord>();
  const conversations = new Map<string, {
    conversation_id: string;
    contact_request_id: string;
    related_post_ids: string[];
    participant_preview: Array<{ user_id: string; alias: string }>;
    status: 'active' | 'closed' | 'blocked';
    created_at: string;
    last_activity_at: string;
    last_message_preview: string | null;
    unread_count: number;
    other_user_id: string;
  }>();
  const conversationMessages = new Map<string, Array<{
    message_id: string;
    conversation_id: string;
    sender_user_id: string;
    sender_alias: string;
    body: string;
    sent_at: string;
    is_mine: boolean;
    safety_flags: string[];
  }>>();

  function currentMatchBatch() {
    const batchOne = {
      post_id: requestPostId,
      batch_number: 1,
      advanced: false,
      refreshes_used: 0,
      max_refreshes: 1,
      items: [
        {
          suggestion_id: suggestionOneId,
          batch_number: 1,
          position: 1,
          candidate_type: 'neighbor_post',
          candidate_id: offerAId,
          score: 0.89,
          reasons: ['same_category', 'same_language', 'within_1_mile', 'verified_user'],
          distance_miles: 0.4,
          neighbor_post: offerA,
          official_resource: null,
        },
        {
          suggestion_id: suggestionTwoId,
          batch_number: 1,
          position: 2,
          candidate_type: 'neighbor_post',
          candidate_id: offerBId,
          score: 0.68,
          reasons: ['same_category', 'within_3_miles'],
          distance_miles: 1.8,
          neighbor_post: offerB,
          official_resource: null,
        },
        {
          suggestion_id: suggestionThreeId,
          batch_number: 1,
          position: 3,
          candidate_type: 'official_resource',
          candidate_id: resourceId,
          score: 0.62,
          reasons: ['open_today', 'nearby_resource', 'language_supported'],
          distance_miles: 0.2,
          neighbor_post: null,
          official_resource: resource,
        },
      ],
    };

    const batchTwo = {
      post_id: requestPostId,
      batch_number: 2,
      advanced: true,
      refreshes_used: 1,
      max_refreshes: 1,
      items: [
        {
          suggestion_id: suggestionFourId,
          batch_number: 2,
          position: 1,
          candidate_type: 'official_resource',
          candidate_id: resourceId,
          score: 0.62,
          reasons: ['open_today', 'nearby_resource'],
          distance_miles: 0.2,
          neighbor_post: null,
          official_resource: resource,
        },
      ],
    };

    if (!refreshUsed) {
      return batchOne;
    }

    return batchTwo;
  }

  return {
    requesterAnonymousSession,
    requesterVerifiedSession,
    recipientVerifiedSession,
    requestPost,
    offerA,
    offerB,
    resource,
    contacts,
    conversations,
    conversationMessages,
    getBatch(refresh: boolean) {
      if (refresh && !refreshUsed) {
        refreshUsed = true;
        return {
          ...currentMatchBatch(),
          advanced: true,
        };
      }

      return {
        ...currentMatchBatch(),
        advanced: false,
      };
    },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function seedSession(context: BrowserContext, session: SessionPayload) {
  await context.addInitScript(async (seed) => {
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.open('weavenyc-pwa', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('joinedCommunities')) {
          db.createObjectStore('joinedCommunities', { keyPath: 'communityId' });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'key' });
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to seed indexedDB'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['kv'], 'readwrite');
        tx.objectStore('kv').put({
          key: 'auth-session',
          value: seed,
        });
        tx.objectStore('kv').put({
          key: 'preferences',
          value: {
            language: 'en',
            zipCode: '11735',
            onboardingComplete: true,
            lowBandwidth: false,
            bookmarks: [],
          },
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('Failed to write session'));
      };
    });
  }, session);
}

async function installM3Routes(page: Page, state: ReturnType<typeof createSharedState>) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const { pathname, searchParams } = url;
    const method = route.request().method();
    const authHeader = route.request().headers().authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? null;

    if (method === 'OPTIONS' && pathname.startsWith('/v1/')) {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (pathname === '/healthz' || pathname === '/readyz') {
      await fulfillJson(route, {
        status: 'ok',
        service: 'api-gateway',
        timestamp: nowIso(),
      });
      return;
    }

    if (pathname === '/v1/auth/anonymous' && method === 'POST') {
      await fulfillJson(route, state.requesterAnonymousSession);
      return;
    }

    if (pathname === '/v1/auth/otp/start' && method === 'POST') {
      await fulfillJson(route, {
        challenge_id: otpChallengeId,
        masked_destination: '(***) ***-0101',
        delivery_channel: 'sms',
        expires_in_seconds: 600,
        fallback: true,
        demo_code: '246810',
      });
      return;
    }

    if (pathname === '/v1/auth/otp/verify' && method === 'POST') {
      const body = route.request().postDataJSON() as { challenge_id: string; code: string };
      if (body.challenge_id !== otpChallengeId || body.code !== '246810') {
        await fulfillJson(route, { message: 'bad code' }, 400);
        return;
      }

      const nextSession =
        token === state.requesterAnonymousSession.access_token
          ? state.requesterVerifiedSession
          : state.recipientVerifiedSession;
      await fulfillJson(route, nextSession);
      return;
    }

    if (pathname === `/v1/posts/${requestPostId}` && method === 'GET') {
      await fulfillJson(route, state.requestPost);
      return;
    }

    if (pathname === `/v1/posts/${requestPostId}/matches` && method === 'GET') {
      const refresh = searchParams.get('refresh') === 'true';
      await fulfillJson(route, state.getBatch(refresh));
      return;
    }

    if (pathname === '/v1/match/contact' && method === 'POST') {
      const body = route.request().postDataJSON() as { from_post_id: string; to_post_id: string };
      let existing = Array.from(state.contacts.values()).find(
        (item) => item.from_post_id === body.from_post_id && item.to_post_id === body.to_post_id && item.status !== 'rejected',
      );
      if (!existing) {
        existing = {
          contact_request_id: `${generatedContactPrefix}${String(state.contacts.size + 1).padStart(12, '0')}`,
          from_post_id: body.from_post_id,
          to_post_id: body.to_post_id,
          requester_user_id: requesterUserId,
          requester_alias: 'Requester',
          recipient_user_id: recipientUserId,
          status: 'pending',
          created_at: nowIso(),
          expires_at: nowIso(60 * 72),
        };
        state.contacts.set(existing.contact_request_id, existing);
      }

      await fulfillJson(route, {
        contact_request_id: existing.contact_request_id,
        status: existing.status === 'accepted' ? 'accepted' : 'pending',
        conversation_id: existing.conversation_id,
      });
      return;
    }

    if (pathname === '/v1/contact-requests/inbox' && method === 'GET') {
      const items = Array.from(state.contacts.values())
        .filter((item) => item.recipient_user_id === recipientUserId && item.status === 'pending')
        .map((item) => ({
          ...item,
          from_post_title: state.requestPost.title,
          to_post_title: state.offerA.title,
          from_post_category: state.requestPost.category,
          to_post_category: state.offerA.category,
        }));
      await fulfillJson(route, {
        items,
        next_cursor: null,
      });
      return;
    }

    const acceptMatch = pathname.match(/^\/v1\/contact-requests\/([^/]+)\/accept$/);
    if (acceptMatch && method === 'POST') {
      const record = state.contacts.get(acceptMatch[1]!);
      if (!record) {
        await fulfillJson(route, { message: 'not found' }, 404);
        return;
      }

      if (!record.conversation_id) {
        record.conversation_id = `${generatedConversationPrefix}${String(state.conversations.size + 1).padStart(12, '0')}`;
        state.conversations.set(record.conversation_id, {
          conversation_id: record.conversation_id,
          contact_request_id: record.contact_request_id,
          related_post_ids: [record.from_post_id, record.to_post_id],
          participant_preview: [
            { user_id: requesterUserId, alias: 'Requester' },
            { user_id: recipientUserId, alias: 'Helper' },
          ],
          status: 'active',
          created_at: nowIso(),
          last_activity_at: nowIso(),
          last_message_preview: 'Accepted contact request. Chat is now open.',
          unread_count: 1,
          other_user_id: requesterUserId,
        });
        state.conversationMessages.set(record.conversation_id, [
          {
            message_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            conversation_id: record.conversation_id,
            sender_user_id: requesterUserId,
            sender_alias: 'Requester',
            body: 'Accepted contact request. Chat is now open.',
            sent_at: nowIso(),
            is_mine: false,
            safety_flags: [],
          },
        ]);
      }

      record.status = 'accepted';
      record.responded_at = nowIso();

      await fulfillJson(route, {
        contact_request_id: record.contact_request_id,
        status: 'accepted',
        responded_at: record.responded_at,
        conversation_id: record.conversation_id,
      });
      return;
    }

    const rejectMatch = pathname.match(/^\/v1\/contact-requests\/([^/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      const record = state.contacts.get(rejectMatch[1]!);
      if (!record) {
        await fulfillJson(route, { message: 'not found' }, 404);
        return;
      }

      record.status = 'rejected';
      record.responded_at = record.responded_at ?? nowIso();
      await fulfillJson(route, {
        contact_request_id: record.contact_request_id,
        status: 'rejected',
        responded_at: record.responded_at,
      });
      return;
    }

    if (pathname === '/v1/conversations' && method === 'GET') {
      const allowedTokens = [state.requesterVerifiedSession.access_token, state.recipientVerifiedSession.access_token];
      if (!token || !allowedTokens.includes(token)) {
        await fulfillJson(route, { message: 'forbidden' }, 403);
        return;
      }

      await fulfillJson(route, {
        items: Array.from(state.conversations.values()),
        next_cursor: null,
      });
      return;
    }

    const conversationMessagesMatch = pathname.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
    if (conversationMessagesMatch && method === 'GET') {
      const conversation = state.conversations.get(conversationMessagesMatch[1]!);
      if (!conversation) {
        await fulfillJson(route, { message: 'not found' }, 404);
        return;
      }

      const allowedTokens = [state.requesterVerifiedSession.access_token, state.recipientVerifiedSession.access_token];
      if (!token || !allowedTokens.includes(token)) {
        await fulfillJson(route, { message: 'forbidden' }, 403);
        return;
      }

      await fulfillJson(route, {
        items: state.conversationMessages.get(conversation.conversation_id) ?? [],
        next_cursor: null,
      });
      return;
    }

    if (conversationMessagesMatch && method === 'POST') {
      const conversation = state.conversations.get(conversationMessagesMatch[1]!);
      if (!conversation) {
        await fulfillJson(route, { message: 'not found' }, 404);
        return;
      }

      const allowedTokens = [state.requesterVerifiedSession.access_token, state.recipientVerifiedSession.access_token];
      if (!token || !allowedTokens.includes(token)) {
        await fulfillJson(route, { message: 'forbidden' }, 403);
        return;
      }

      const requestBody = route.request().postDataJSON() as { body?: string };
      const senderUserId = token === state.requesterVerifiedSession.access_token ? requesterUserId : recipientUserId;
      const senderAlias = senderUserId === requesterUserId ? 'Requester' : 'Helper';
      const message = {
        message_id: `${generatedConversationPrefix}${String((state.conversationMessages.get(conversation.conversation_id)?.length ?? 0) + 10).padStart(12, '0')}`,
        conversation_id: conversation.conversation_id,
        sender_user_id: senderUserId,
        sender_alias: senderAlias,
        body: requestBody.body ?? 'Fallback message',
        sent_at: nowIso(),
        is_mine: senderUserId === requesterUserId,
        safety_flags: [],
      };
      const messages = state.conversationMessages.get(conversation.conversation_id) ?? [];
      messages.push(message);
      state.conversationMessages.set(conversation.conversation_id, messages);
      conversation.last_message_preview = message.body;
      conversation.last_activity_at = message.sent_at;

      await fulfillJson(route, {
        conversation_id: conversation.conversation_id,
        message,
      });
      return;
    }

    const conversationMatch = pathname.match(/^\/v1\/conversations\/([^/]+)$/);
    if (conversationMatch && method === 'GET') {
      const conversation = state.conversations.get(conversationMatch[1]!);
      if (!conversation) {
        await fulfillJson(route, { message: 'not found' }, 404);
        return;
      }

      const allowedTokens = [state.requesterVerifiedSession.access_token, state.recipientVerifiedSession.access_token];
      if (!token || !allowedTokens.includes(token)) {
        await fulfillJson(route, { message: 'forbidden' }, 403);
        return;
      }

      await fulfillJson(route, {
        ...conversation,
        actions: {
          can_send: conversation.status === 'active',
          can_close: conversation.status === 'active',
          can_block: conversation.status !== 'blocked',
          can_report: true,
        },
      });
      return;
    }

    if (pathname.startsWith('/v1/resources')) {
      await fulfillJson(route, {
        items: [state.resource],
        next_cursor: null,
        source_mode: 'fixture',
      });
      return;
    }

    await route.fallback();
  });
}

test('anonymous contact -> verify -> auto contact creation and one refresh only', async ({ page }) => {
  const state = createSharedState();
  await seedSession(page.context(), state.requesterAnonymousSession);
  await installM3Routes(page, state);

  await page.goto(`/posts/${requestPostId}/matches`);

  await expect(page.getByRole('heading', { level: 1, name: '3 ways to get help now' })).toBeVisible();
  await expect(page.getByText('Need groceries tonight')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send a message' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Send a message' }).first().click();
  await page.waitForURL((url) => url.pathname.startsWith('/verify'));
  await expect(page.getByTestId('verify-title')).toBeVisible();

  await page.getByLabel('Phone number').fill('+15165550101');
  await page.getByRole('button', { name: 'Send my code' }).click();
  await page.getByLabel('6-digit code').fill('246810');
  await page.getByTestId('verify-code').click();

  await page.waitForURL((url) => url.pathname.startsWith(`/posts/${requestPostId}/matches`));
  await expect(page.getByText('Your message was sent. The other person will see it in their messages.')).toBeVisible();

  const refreshButton = page.getByRole('button', { name: 'Show other options' });
  await expect(refreshButton).toBeEnabled();
  await refreshButton.click();
  await expect(page.locator('.card__subtitle', { hasText: '1/1 options you have swapped' })).toBeVisible();
  await expect(refreshButton).toBeDisabled();
});

test('verified recipient contact inbox accept/reject flow reaches the live conversation thread', async ({ browser }) => {
  const state = createSharedState();
  state.contacts.set(contactOneId, {
    contact_request_id: contactOneId,
    from_post_id: requestPostId,
    to_post_id: offerAId,
    requester_user_id: requesterUserId,
    requester_alias: 'Requester',
    recipient_user_id: recipientUserId,
    status: 'pending',
    created_at: nowIso(-15),
    expires_at: nowIso(60 * 72),
  });
  state.contacts.set(contactTwoId, {
    contact_request_id: contactTwoId,
    from_post_id: requestPostId,
    to_post_id: offerAId,
    requester_user_id: requesterUserId,
    requester_alias: 'Requester',
    recipient_user_id: recipientUserId,
    status: 'pending',
    created_at: nowIso(-10),
    expires_at: nowIso(60 * 72),
  });

  const context = await browser.newContext();
  await seedSession(context, state.recipientVerifiedSession);
  const page = await context.newPage();
  await installM3Routes(page, state);

  await page.goto('/contact-requests');
  await expect(page.locator('h1', { hasText: 'My messages' })).toBeVisible();
  await expect(page.getByText('Requester')).toHaveCount(2);

  await page.getByRole('button', { name: 'Accept' }).first().click();
  await page.waitForURL('**/conversations/**');
  await expect(page.getByText('Requester').first()).toBeVisible();
  await expect(page.getByText('Helper')).toBeVisible();
  await page.getByLabel('Message').fill('See you at the library after 3pm.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('See you at the library after 3pm.')).toBeVisible();

  await page.goto('/contact-requests');
  await page.getByRole('button', { name: 'Decline' }).first().click();
  await expect(page.getByText('Requester')).toHaveCount(0);

  await context.close();
});
