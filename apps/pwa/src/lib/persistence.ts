import type { AuthSession, CommunityState, PostDraftState, PreferencesState } from "@/lib/types";

import { getPwaDb } from "@/lib/db";

const PREFERENCES_STORAGE_KEY = "preferences";
const AUTH_SESSION_STORAGE_KEY = "auth-session";
const CURRENT_COMMUNITY_STORAGE_KEY = "community-current";
const POST_DRAFT_STORAGE_KEY = "post-draft";

export async function loadPreferences(): Promise<Partial<PreferencesState> | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.kv.get(PREFERENCES_STORAGE_KEY);
    return (row?.value as Partial<PreferencesState> | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function savePreferences(preferences: PreferencesState) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await db.kv.put({
      key: PREFERENCES_STORAGE_KEY,
      value: preferences,
    });
  } catch {
    return;
  }
}

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.kv.get(AUTH_SESSION_STORAGE_KEY);
    return (row?.value as AuthSession | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession | null) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    if (!session) {
      await db.kv.delete(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    await db.kv.put({
      key: AUTH_SESSION_STORAGE_KEY,
      value: session,
    });
  } catch {
    return;
  }
}

export async function loadCommunityState(): Promise<Partial<CommunityState> | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const [currentRow, joinedRows] = await Promise.all([
      db.kv.get(CURRENT_COMMUNITY_STORAGE_KEY),
      db.joinedCommunities.toArray(),
    ]);

    return {
      currentCommunityId: (currentRow?.value as string | undefined) ?? null,
      joinedCommunities: joinedRows.map((row) => row.value),
    };
  } catch {
    return null;
  }
}

export async function saveCommunityState(state: CommunityState) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await Promise.all([
      db.kv.put({
        key: CURRENT_COMMUNITY_STORAGE_KEY,
        value: state.currentCommunityId,
      }),
      db.transaction('rw', db.joinedCommunities, async () => {
        await db.joinedCommunities.clear();
        if (state.joinedCommunities.length > 0) {
          await db.joinedCommunities.bulkPut(
            state.joinedCommunities.map((community) => ({
              communityId: community.community.community_id,
              value: community,
            })),
          );
        }
      }),
    ]);
  } catch {
    return;
  }
}

export async function loadPostDraft(): Promise<PostDraftState | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.drafts.get(POST_DRAFT_STORAGE_KEY);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function savePostDraft(postDraft: PostDraftState) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await db.drafts.put({
      key: POST_DRAFT_STORAGE_KEY,
      value: postDraft,
    });
  } catch {
    return;
  }
}

export async function clearPostDraft() {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await db.drafts.delete(POST_DRAFT_STORAGE_KEY);
  } catch {
    return;
  }
}
