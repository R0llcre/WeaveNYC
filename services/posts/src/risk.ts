import type { CreatePostRequest, RiskLevel } from '@weavenyc/shared';

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

export function requiresReview(riskLevel: RiskLevel) {
  return riskLevel === 'high';
}
