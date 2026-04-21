# Offline Write Outbox (Subway-Safe Post Publish)

Status: shipped in `feat/offline-outbox` (M8.5 / P5 audit finding 5).
Scope: PWA post publish only.

## The Guarantee

If you hit **Publish**, your draft is saved to the device **before** the HTTP
request fires. A network drop, tab close, or device reload between the tap
and the server response cannot lose the body.

On the next trigger (`online` event, tab refocus, or app mount) the
background outbox drain replays the queued publish against the server and
clears the entry on success.

This closes the NYC-subway use case:

> Alice rides the N train between two stations. Mid-transit she drafts a
> post asking for a ride home, hits Publish as she's about to lose signal,
> and expects her post to go out "when the train gets back above ground."
> Pre-M8.5 that tap was a no-op — the `fetch` threw, the composer reset,
> the body vanished. Post-M8.5 the draft is persisted to IndexedDB and
> replayed the moment the phone reconnects.

## Lifecycle

```
┌─ User taps Publish ────────────────────────────────────────────┐
│ 1. Generate client_id = crypto.randomUUID()                    │
│ 2. enqueuePendingPost(entry) → IndexedDB (pendingPosts table)  │
│ 3. Reset the composer draft (subway-safe: draft is already in  │
│    IDB; the composer is a fresh slate either way).             │
│ 4. Show optimistic toast (`toastSent` — "Sent" / "Enviado").   │
│ 5a. If navigator.onLine === false → navigate to /posts/mine/   │
│     and stop. The drain will pick up when the network returns. │
│ 5b. Else → fire createPost() in the background:                │
│     - on 2xx: removePendingPost(client_id) + invalidate cache  │
│       + navigate to /posts/{id}/                               │
│     - on 4xx/5xx/network: leave entry in IDB, navigate to      │
│       /posts/mine/ so the user sees the pending row.           │
└────────────────────────────────────────────────────────────────┘

┌─ useOutboxDrain (mounted in ShellFrame) ───────────────────────┐
│ Triggers: on mount, on window.online, on                       │
│   document.visibilitychange === 'visible'                      │
│ For each pending entry (oldest first):                         │
│   - Skip if last_failure_permanent (4xx) — wait for user retry │
│   - Call createPost(access_token, entry.payload)               │
│   - 2xx  → removePendingPost + queryClient.invalidateQueries   │
│   - 4xx  → markPendingPostAttempt(..., {permanent: true});     │
│            continue walk (other entries may still send)        │
│   - 5xx / network / timeout →                                  │
│            markPendingPostAttempt(..., {permanent: false});    │
│            STOP the pass (exponential backoff = next trigger)  │
└────────────────────────────────────────────────────────────────┘
```

## Storage

IndexedDB — Dexie schema version 4 (additive, backward-compatible with
v3). The table `pendingPosts` is keyed on `client_id` with secondary
indices on `community_id` (so the pending UI can scope by community) and
`created_at` (for oldest-first drain ordering).

Row shape (`PendingPostEntry`):

```ts
{
  client_id: string;                  // crypto.randomUUID(), primary key
  created_at: string;                 // ISO when the user tapped Publish
  attempt_count: number;              // incremented on each retry
  last_attempt_at: string | null;
  last_error: string | null;
  last_failure_permanent: boolean;    // 4xx → true, 5xx/network → false
  payload: CreatePostInput;           // verbatim replay input
  community_id: string;
}
```

## Retention

Entries stay in IndexedDB until either **successfully sent** or
**explicitly discarded** by the user via the pending-posts UI on
`/posts/mine/`. There is **no TTL** — a user who queues a post, uninstalls
the PWA from the home screen, and reinstalls three months later will see
their queued post on the pending list and can choose to retry or discard
it.

If this ever proves surprising to users (e.g. a 3-month-old offer becomes
meaningless), we can add a user-configurable retention window later. For
the MVP, explicit-discard is preferable to silent TTL deletion — the
draft is their work, and auto-deleting it is a second kind of data loss
the outbox was meant to prevent.

## Failure Modes

| Failure                                    | Behaviour                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Client crash / reload between enqueue + send | Entry is already in IDB. Next mount + `useOutboxDrain` picks it up and retries.          |
| Network offline at publish-time             | HTTP attempt is skipped. User navigates to `/posts/mine/` and sees a pending row.        |
| 5xx / timeout / network error on drain      | `attempt_count++`, `last_error` stamped. Drain stops for this pass. Retry on next trigger. |
| 4xx (validation, forbidden, etc.)          | Entry is marked `last_failure_permanent: true` — **no auto-retry**. User must discard or Retry via the UI. |
| Tab closed mid-drain                       | Drain is idempotent per `client_id`. Worst case: the drain re-lists the entry on the next trigger and re-attempts. If the server already committed the write, a duplicate might surface — see "Out of Scope" below. |

## In Scope

- Post publish (`POST /v1/posts` via `createPost`)

## Out of Scope (Future Iterations)

- Chat message send
- Bookmark writes
- Preference updates
- Cross-tab sync — a second tab opening won't see the queue until its own
  drain fires on mount. Acceptable for the MVP since the drain is
  idempotent per entry and the user-facing list is polled on visibility.
- Server-side idempotency key — **shipped in PR #49** (server) and PR #55
  (PWA client). The api-gateway accepts `Idempotency-Key` on `POST /v1/posts`,
  `POST /v1/conversations/{id}/messages`, and `POST /v1/chat-safety/report`;
  see [`09_API_Spec.md §1.10`](./09_API_Spec.md). The PWA `createPost()` / chat send
  / report paths all set the header. The remaining outbox follow-up is
  to thread the stable `client_id` of each pending entry through to
  `createPost()` as the `idempotencyKey`, so that a retry for the same
  queued draft dedupes on the server within the 24h TTL. Today, each
  retry generates a fresh key, so a 5xx-after-commit can still surface
  as a duplicate post — tracked as a small follow-up, no longer a
  server-side gap.
- User-configurable retry cadence / TTL.

## Files

- `apps/pwa/src/lib/db.ts` — Dexie v4 schema + `PendingPostEntry` type.
- `apps/pwa/src/lib/persistence.ts` — `enqueuePendingPost`, `listPendingPosts`, `markPendingPostAttempt`, `removePendingPost`.
- `apps/pwa/src/lib/hooks.ts` — `useOutboxDrain` hook.
- `apps/pwa/src/components/shell/ShellFrame.tsx` — mounts the drain loop.
- `apps/pwa/src/components/post-composer-screen.tsx` — optimistic enqueue on publish tap.
- `apps/pwa/src/components/my-posts-screen.tsx` — pending section on `/posts/mine/` with Retry / Discard actions.
- `apps/pwa/src/lib/i18n.ts` — `outboxPendingHeading` / `outboxPendingHint` / `outboxFailedHint` / `outboxRetryAction` / `outboxDiscardAction` / `outboxQueuedToast` / `outboxDrainingToast` keys (en/es/zh parity).

## Testids (E2E contract)

- `my-posts-pending-section` — pending section wrapper
- `my-post-pending-{client_id}` — a single pending row
- `pending-retry-{client_id}` — "Retry now" button (only for `last_failure_permanent` entries)
- `pending-discard-{client_id}` — "Discard" button (present on every pending row)

Compose-screen testids (`select-request`, `select-offer`, `preview-post`,
`publish-post`, `browser-speech`, `create-session`) are preserved
unchanged — the outbox rewrite is behind `handlePublish` and does not
touch the DOM contract.
