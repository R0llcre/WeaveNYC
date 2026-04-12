import type { MatchContactIntent } from '@/lib/types';

const MATCH_CONTACT_INTENT_KEY = 'weavenyc.match-contact-intent';

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function loadMatchContactIntent(): MatchContactIntent | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(MATCH_CONTACT_INTENT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<MatchContactIntent>;
    if (
      parsed.kind !== 'match_contact' ||
      !parsed.fromPostId ||
      !parsed.toPostId ||
      !parsed.returnTo ||
      !parsed.createdAt ||
      !parsed.targetTitle
    ) {
      return null;
    }

    return {
      kind: 'match_contact',
      fromPostId: parsed.fromPostId,
      toPostId: parsed.toPostId,
      returnTo: parsed.returnTo,
      createdAt: parsed.createdAt,
      targetTitle: parsed.targetTitle,
    };
  } catch {
    return null;
  }
}

export function saveMatchContactIntent(intent: MatchContactIntent) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(MATCH_CONTACT_INTENT_KEY, JSON.stringify(intent));
  } catch {
    return;
  }
}

export function clearMatchContactIntent() {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(MATCH_CONTACT_INTENT_KEY);
  } catch {
    return;
  }
}
