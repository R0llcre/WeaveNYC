import type { AuthSession, PreferencesState } from "@/lib/types";

import { getPwaDb } from "@/lib/db";

const PREFERENCES_STORAGE_KEY = "preferences";
const AUTH_SESSION_STORAGE_KEY = "auth-session";

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
