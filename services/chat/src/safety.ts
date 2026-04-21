import { HARASSMENT_PATTERNS, HATE_PATTERNS } from "./safety-phrases.js";
import type {
  ChatActor,
  ChatSafetyDetector,
  ChatSafetyFlag,
  ChatSafetyInspection,
  ConversationDetail,
} from "./types.js";

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;

// Phone PII: keep the North American parenthesized/dashed pattern (tight
// and anchored) and add an E.164 alternation for international numbers
// like `+442071234567`, `+86 138 0013 8000`. The E.164 branch requires a
// leading `+` so a bare digit run (Zoom IDs, order numbers) does not
// trip a phone flag. Total digit count 8..15 after the leading
// non-zero, which spans ITU-T E.164.
const PHONE_NA_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/;
const PHONE_E164_PATTERN = /\+[1-9](?:[\s-]?\d){7,14}\b/;

const ADDRESS_PATTERN =
  /\b\d{1,5}\s+[a-z0-9.'-]+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct)\b/i;

// Bank / card PII: the previous raw digit-run regex matched any 10-18
// digit sequence, which trivially flagged Zoom meeting IDs, order
// numbers, tracking numbers, etc. (A2 P0-7 audit). Narrow to a
// Luhn-valid 13..19-digit sequence. Separators (`-`, ` `) are stripped
// before checking Luhn so typical card formats still match.
const BANK_CANDIDATE_PATTERN = /\b(?:\d[ -]?){12,18}\d\b/g;

/**
 * Standard Luhn checksum. Returns true for a valid credit-card /
 * bank-routing run of 13..19 digits. Callers must strip separators
 * (space, hyphen) before invoking.
 */
export function isLuhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number.parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function hasLuhnValidBankRun(body: string): boolean {
  BANK_CANDIDATE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BANK_CANDIDATE_PATTERN.exec(body)) !== null) {
    const digits = match[0].replace(/[ -]/g, "");
    if (isLuhnValid(digits)) {
      return true;
    }
  }
  return false;
}

const KEYWORD_FLAGS: Array<{ pattern: RegExp; flag: ChatSafetyFlag }> = [
  { pattern: /\bpassport\b/i, flag: "keyword_passport" },
  { pattern: /\bbank\b/i, flag: "keyword_bank" },
  { pattern: /\bwire\b/i, flag: "keyword_wire" },
  { pattern: /\bcrypto\b/i, flag: "keyword_crypto" },
  { pattern: /\bgift\s*card\b/i, flag: "keyword_gift_card" },
];

function anyMatches(patterns: RegExp[], body: string): boolean {
  for (const pattern of patterns) {
    if (pattern.test(body)) return true;
  }
  return false;
}

export class DefaultChatSafetyDetector implements ChatSafetyDetector {
  inspectMessage(input: {
    actor: ChatActor;
    conversation: ConversationDetail;
    body: string;
  }): ChatSafetyInspection {
    void input.actor;
    void input.conversation;
    const blockingFlags: ChatSafetyFlag[] = [];
    const advisoryFlags: ChatSafetyFlag[] = [];

    if (SSN_PATTERN.test(input.body)) {
      blockingFlags.push("sensitive_ssn");
    }
    if (PHONE_E164_PATTERN.test(input.body) || PHONE_NA_PATTERN.test(input.body)) {
      blockingFlags.push("sensitive_phone");
    }
    if (ADDRESS_PATTERN.test(input.body)) {
      blockingFlags.push("sensitive_address");
    }
    if (hasLuhnValidBankRun(input.body)) {
      blockingFlags.push("sensitive_bank_account");
    }

    // Hate speech / harassment blocklist (A2 P0-1). Blocks send; does
    // not surface the offending terms back to the sender.
    if (anyMatches(HATE_PATTERNS, input.body)) {
      blockingFlags.push("hate_speech");
    }
    if (anyMatches(HARASSMENT_PATTERNS, input.body)) {
      blockingFlags.push("harassment");
    }

    for (const rule of KEYWORD_FLAGS) {
      if (rule.pattern.test(input.body) && !advisoryFlags.includes(rule.flag)) {
        advisoryFlags.push(rule.flag);
      }
    }

    const blocked = blockingFlags.length > 0;
    return {
      blocked,
      blockingFlags,
      advisoryFlags,
      userMessage: blocked
        ? blockingFlags.includes("hate_speech") || blockingFlags.includes("harassment")
          ? "This message violates the community guidelines. Please revise before sending."
          : "Detected personal information in the message. Remove it before sending."
        : undefined,
    };
  }
}

export const defaultChatSafetyDetector = new DefaultChatSafetyDetector();
