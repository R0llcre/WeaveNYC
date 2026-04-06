import type { ResolveCommunityAccessInput } from './types.js';

export function normalizeCommunityAccessInput(input: ResolveCommunityAccessInput) {
  return {
    userId: input.userId,
    inviteCode: input.inviteCode?.trim(),
    qrToken: input.qrToken?.trim(),
  };
}
