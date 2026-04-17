import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

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
  assert.match(state.askError ?? "", /at most 10 messages per minute/i);
  assert.equal(state.messages.length, 0);
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
  assert.match(state.askError ?? "", /daily limit of 100 messages/i);
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[1]?.role, "assistant");
  assert.match(state.messages[1]?.error ?? "", /daily limit of 100 messages/i);
});
