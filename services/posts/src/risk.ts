import type { CreatePostRequest, PostCategory, RiskLevel } from '@weavenyc/shared';

const highRiskPattern = /\b(cash|money|venmo|zelle|passport|license|id|pickup|drop.?off|alone|minor|child)\b/i;

export function classifyPostRisk(input: Pick<CreatePostRequest, 'category' | 'title' | 'body'>): RiskLevel {
  if (input.category === 'childcare' || input.category === 'transportation') {
    return 'high';
  }

  if (input.category === 'companionship') {
    return 'medium';
  }

  if (highRiskPattern.test(`${input.title} ${input.body}`)) {
    return 'high';
  }

  return 'low';
}

export function requiresVerifiedLevel(riskLevel: RiskLevel, postType: CreatePostRequest['post_type']) {
  return postType === 'offer' || riskLevel === 'high';
}

export function requiresReview(
  riskLevel: RiskLevel,
  category: PostCategory,
  reviewCategories: readonly PostCategory[]
) {
  return riskLevel === 'high' || reviewCategories.includes(category);
}

export function findKeywordBlocklistMatch(value: string, blocklist: readonly string[]) {
  const haystack = value.trim().toLowerCase();
  if (!haystack) {
    return null;
  }

  for (const entry of blocklist) {
    const normalized = entry.trim().toLowerCase();
    if (normalized && haystack.includes(normalized)) {
      return entry;
    }
  }

  return null;
}
