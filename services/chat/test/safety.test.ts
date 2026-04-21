import { describe, expect, it } from "vitest";

import {
  DefaultChatSafetyDetector,
  defaultChatSafetyDetector,
  isLuhnValid,
} from "../src/safety.js";
import type {
  ChatActor,
  ConversationDetail,
  ChatSafetyFlag,
} from "../src/types.js";

const actor: ChatActor = {
  userId: "11111111-1111-4111-8111-111111111111",
  level: "verified",
  alias: "Neighbor",
  communityIds: ["44444444-4444-4444-8444-444444444444"],
};

const conversation: ConversationDetail = {
  conversation_id: "33333333-3333-4333-8333-333333333333",
  contact_request_id: "44444444-4444-4444-8444-444444444444",
  participant_user_ids: [
    actor.userId,
    "22222222-2222-4222-8222-222222222222",
  ],
  participant_preview: [
    { user_id: actor.userId, alias: actor.alias! },
    {
      user_id: "22222222-2222-4222-8222-222222222222",
      alias: "Other",
    },
  ],
  related_post_ids: ["55555555-5555-4555-8555-555555555555"],
  status: "active",
  created_at: "2026-04-21T12:00:00.000Z",
  last_activity_at: "2026-04-21T12:00:00.000Z",
  closed_at: null,
  blocked_at: null,
  blocked_by_user_id: null,
  last_message_preview: null,
  last_message_at: null,
  unread_count: 0,
  other_participant: {
    user_id: "22222222-2222-4222-8222-222222222222",
    alias: "Other",
  },
  can_send: true,
};

function inspect(body: string, detector = defaultChatSafetyDetector) {
  return detector.inspectMessage({ actor, conversation, body });
}

describe("DefaultChatSafetyDetector — hate speech blocklist (A2 P0-1)", () => {
  describe("English", () => {
    it("blocks a common English slur", () => {
      const result = inspect("go home you faggot");
      expect(result.blocked).toBe(true);
      expect(result.blockingFlags).toContain<ChatSafetyFlag>("hate_speech");
    });

    it("does not flag benign English neighborly chat", () => {
      const result = inspect("Welcome to the block — happy to help with the stoop sale.");
      expect(result.blocked).toBe(false);
      expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("hate_speech");
      expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("harassment");
    });
  });

  describe("Spanish", () => {
    it("blocks a common Spanish slur", () => {
      const result = inspect("no te quiero aqui, maricon");
      expect(result.blocked).toBe(true);
      expect(result.blockingFlags).toContain<ChatSafetyFlag>("hate_speech");
    });

    it("does not flag benign Spanish neighborly chat", () => {
      const result = inspect("Hola vecino, bienvenido al edificio.");
      expect(result.blocked).toBe(false);
      expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("hate_speech");
    });
  });

  describe("Simplified Chinese", () => {
    it("blocks a common Simplified Chinese slur", () => {
      const result = inspect("你这个黑鬼");
      expect(result.blocked).toBe(true);
      expect(result.blockingFlags).toContain<ChatSafetyFlag>("hate_speech");
    });

    it("does not flag benign Simplified Chinese neighborly chat", () => {
      const result = inspect("你好邻居,欢迎来到社区。");
      expect(result.blocked).toBe(false);
      expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("hate_speech");
    });
  });
});

describe("DefaultChatSafetyDetector — harassment blocklist (A2 P0-1)", () => {
  describe("English", () => {
    it("blocks a direct English threat", () => {
      const result = inspect("I will kill you if you post here again");
      expect(result.blocked).toBe(true);
      expect(result.blockingFlags).toContain<ChatSafetyFlag>("harassment");
    });

    it("does not flag benign English chat that mentions unrelated violence words", () => {
      const result = inspect("The Yankees killed it last night — what a game.");
      expect(result.blocked).toBe(false);
      expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("harassment");
    });
  });

  describe("Spanish", () => {
    it("blocks a direct Spanish threat", () => {
      const result = inspect("te voy a matar si vuelves a escribir");
      expect(result.blocked).toBe(true);
      expect(result.blockingFlags).toContain<ChatSafetyFlag>("harassment");
    });

    it("does not flag benign Spanish chat", () => {
      const result = inspect("Nos vemos en la reunion del edificio el sabado.");
      expect(result.blocked).toBe(false);
      expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("harassment");
    });
  });

  describe("Simplified Chinese", () => {
    it("blocks a direct Simplified Chinese threat", () => {
      const result = inspect("我要杀你全家");
      expect(result.blocked).toBe(true);
      expect(result.blockingFlags).toContain<ChatSafetyFlag>("harassment");
    });

    it("does not flag benign Simplified Chinese chat", () => {
      const result = inspect("周六社区聚会见!");
      expect(result.blocked).toBe(false);
      expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("harassment");
    });
  });
});

describe("DefaultChatSafetyDetector — PII regressions (A2 P0-7)", () => {
  it("still blocks the existing SSN pattern (regression guard)", () => {
    const result = inspect("My SSN is 123-45-6789.");
    expect(result.blocked).toBe(true);
    expect(result.blockingFlags).toContain<ChatSafetyFlag>("sensitive_ssn");
  });

  it("still blocks an explicit US address (regression guard)", () => {
    const result = inspect("Meet me at 123 Roebling Street.");
    expect(result.blocked).toBe(true);
    expect(result.blockingFlags).toContain<ChatSafetyFlag>("sensitive_address");
  });

  it("does NOT flag an order number as a bank account (false-positive fix)", () => {
    // Previous BANK_PATTERN matched any 10..18 digit run — common order
    // numbers, Zoom IDs, tracking numbers would flag. With Luhn
    // validation, random digit runs should no longer block.
    const result = inspect("Your order number is ORD-1234567890123. Thanks!");
    expect(result.blockingFlags).not.toContain<ChatSafetyFlag>("sensitive_bank_account");
    expect(result.blocked).toBe(false);
  });

  it("blocks a Luhn-valid Visa test PAN (true-positive bank)", () => {
    // Visa test PAN "4111 1111 1111 1111" is Luhn-valid and used only
    // for testing — it must still block as a bank number.
    const result = inspect("Card: 4111 1111 1111 1111");
    expect(result.blockingFlags).toContain<ChatSafetyFlag>("sensitive_bank_account");
    expect(result.blocked).toBe(true);
  });

  it("blocks an international E.164 phone number", () => {
    const result = inspect("Call me at +442071234567 after work.");
    expect(result.blockingFlags).toContain<ChatSafetyFlag>("sensitive_phone");
    expect(result.blocked).toBe(true);
  });

  it("still blocks a domestic NA phone number", () => {
    const result = inspect("My number is (646) 555-0123.");
    expect(result.blockingFlags).toContain<ChatSafetyFlag>("sensitive_phone");
    expect(result.blocked).toBe(true);
  });
});

describe("isLuhnValid helper", () => {
  it("accepts a known-good Visa test PAN", () => {
    expect(isLuhnValid("4111111111111111")).toBe(true);
  });

  it("rejects a random 13-digit run", () => {
    expect(isLuhnValid("1234567890123")).toBe(false);
  });

  it("rejects non-digits and out-of-range lengths", () => {
    expect(isLuhnValid("abcd")).toBe(false);
    expect(isLuhnValid("411111")).toBe(false); // too short
    expect(isLuhnValid("41111111111111111111")).toBe(false); // too long
  });
});

describe("DefaultChatSafetyDetector — instance", () => {
  it("produces a coherent user message when the block reason is hate or harassment", () => {
    const detector = new DefaultChatSafetyDetector();
    const result = detector.inspectMessage({
      actor,
      conversation,
      body: "you are a faggot",
    });
    expect(result.userMessage).toMatch(/community guidelines/i);
  });
});
