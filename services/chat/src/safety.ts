import type {
  ChatActor,
  ChatSafetyDetector,
  ChatSafetyFlag,
  ChatSafetyInspection,
  ConversationDetail,
} from "./types.js";

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/;
const ADDRESS_PATTERN =
  /\b\d{1,5}\s+[a-z0-9.'-]+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct)\b/i;
const BANK_PATTERN = /\b(?:\d[ -]?){9,17}\d\b/;

const KEYWORD_FLAGS: Array<{ pattern: RegExp; flag: ChatSafetyFlag }> = [
  { pattern: /\bpassport\b/i, flag: "keyword_passport" },
  { pattern: /\bbank\b/i, flag: "keyword_bank" },
  { pattern: /\bwire\b/i, flag: "keyword_wire" },
  { pattern: /\bcrypto\b/i, flag: "keyword_crypto" },
  { pattern: /\bgift\s*card\b/i, flag: "keyword_gift_card" },
];

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
    if (PHONE_PATTERN.test(input.body)) {
      blockingFlags.push("sensitive_phone");
    }
    if (ADDRESS_PATTERN.test(input.body)) {
      blockingFlags.push("sensitive_address");
    }
    if (BANK_PATTERN.test(input.body)) {
      blockingFlags.push("sensitive_bank_account");
    }

    for (const rule of KEYWORD_FLAGS) {
      if (rule.pattern.test(input.body) && !advisoryFlags.includes(rule.flag)) {
        advisoryFlags.push(rule.flag);
      }
    }

    return {
      blocked: blockingFlags.length > 0,
      blockingFlags,
      advisoryFlags,
      userMessage:
        blockingFlags.length > 0
          ? "Detected personal information in the message. Remove it before sending."
          : undefined,
    };
  }
}

export const defaultChatSafetyDetector = new DefaultChatSafetyDetector();
