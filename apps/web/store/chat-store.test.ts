import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { useChatStore } from "./chat-store";

afterEach(() => {
  useChatStore.getState().resetChat();
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
