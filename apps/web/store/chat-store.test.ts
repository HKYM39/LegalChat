import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { INPUT_SECURITY_ERROR_CODE, createInputSecurityViolation } from "shared";

import { clearChatRateLimitState } from "@/lib/chat-rate-limit";
import { useChatStore } from "./chat-store";

class LocalStorageMock implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

if (!("window" in globalThis)) {
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: new LocalStorageMock() },
    configurable: true,
  });
}

afterEach(() => {
  useChatStore.getState().resetChat();
  clearChatRateLimitState();
});

test("chat store applies a suggested prompt to the composer", () => {
  useChatStore
    .getState()
    .applySuggestedPrompt("Find the leading negligence cases.");

  assert.equal(
    useChatStore.getState().currentInput,
    "Find the leading negligence cases.",
  );
});

test("chat store submits a question and appends a grounded assistant response", async () => {
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        messageId: "assistant-1",
        role: "assistant",
        query: "What is the duty of care test?",
        normalizedQuery: "What is the duty of care test?",
        queryType: "natural_language_query",
        answerText: "Grounded answer text.",
        authorities: [],
        supportingExcerpts: [],
        limitations: [],
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  };

  await useChatStore
    .getState()
    .submitQuestion("What is the duty of care test?");

  const state = useChatStore.getState();
  assert.equal(state.isAsking, false);
  assert.equal(state.askError, null);
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[0]?.role, "user");
  assert.equal(state.messages[1]?.role, "assistant");
  assert.equal(
    state.messages[1]?.response?.answerText,
    "Grounded answer text.",
  );
  assert.ok(requestedUrl.includes("/ask"));
});

test("chat store blocks submission when local minute rate limit is exceeded", async () => {
  globalThis.fetch = async () => {
    throw new Error("fetch should not be called when locally rate limited");
  };

  for (let index = 0; index < 10; index += 1) {
    await useChatStore.getState().submitQuestion(`Question ${index + 1}`);
    useChatStore.getState().resetChat();
  }

  await useChatStore.getState().submitQuestion("Blocked question");

  const state = useChatStore.getState();
  assert.match(state.askError ?? "", /10\s*条消息|10 messages/i);
  assert.equal(state.messages.length, 0);
});

test("chat store blocks suspicious input locally and does not call /ask", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called for blocked input");
  };

  await useChatStore
    .getState()
    .submitQuestion("<script>alert('xss')</script> summarize this case");

  const state = useChatStore.getState();
  assert.equal(fetchCalled, false);
  assert.equal(state.messages.length, 0);
  assert.equal(state.inputSecurityViolation?.reasonCode, "script_injection_detected");
  assert.equal(state.askError, state.inputSecurityViolation?.message ?? null);
});

test("chat store keeps the user message and exposes an error when ask fails", async () => {
  globalThis.fetch = async () => {
    throw new Error("Backend unavailable");
  };

  await useChatStore.getState().submitQuestion("Explain procedural fairness.");

  const state = useChatStore.getState();
  assert.equal(state.isAsking, false);
  assert.equal(state.askError, "Backend unavailable");
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[0]?.role, "user");
  assert.equal(state.messages[1]?.role, "assistant");
  assert.equal(state.messages[1]?.error, "Backend unavailable");
});

test("chat store surfaces backend rate limit errors with a specific message", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "chat_rate_limit_exceeded",
          message: "Chat rate limit exceeded.",
          details: {
            window: "day",
            limit: 100,
            retryAfterSeconds: 1_800,
            resetAt: new Date("2026-04-17T00:00:00.000Z").toISOString(),
          },
        },
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
        },
      },
    );

  await useChatStore.getState().submitQuestion("Explain procedural fairness.");

  const state = useChatStore.getState();
  assert.match(state.askError ?? "", /100\s*条消息|100 messages/i);
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[1]?.role, "assistant");
  assert.match(state.messages[1]?.error ?? "", /100\s*条消息|100 messages/i);
});

test("chat store maps backend input security rejection to the shared security message", async () => {
  const violation = createInputSecurityViolation("protocol_probe_detected");

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: INPUT_SECURITY_ERROR_CODE,
          message: violation.message,
          details: violation,
        },
      }),
      {
        status: 422,
        headers: {
          "content-type": "application/json",
        },
      },
    );

  await useChatStore
    .getState()
    .submitQuestion("What is the duty of care analysis?");

  const state = useChatStore.getState();
  const assistantMessage = state.messages[1];
  assert.equal(state.inputSecurityViolation?.reasonCode, "protocol_probe_detected");
  assert.equal(state.askError, violation.message);
  assert.equal(state.messages.length, 2);
  assert.equal(assistantMessage?.role, "assistant");
  assert.equal(
    assistantMessage?.role === "assistant"
      ? assistantMessage.response?.limitations[0]
      : undefined,
    violation.message,
  );
});
