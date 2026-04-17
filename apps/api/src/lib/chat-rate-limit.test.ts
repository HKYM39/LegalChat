import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryChatRateLimiter, resolveChatRateLimitSubject } from "./chat-rate-limit";

test("in-memory chat rate limiter blocks requests after minute limit is reached", () => {
  const limiter = new InMemoryChatRateLimiter({
    perMinute: 2,
    perDay: 10,
    logEnabled: false,
  });

  const subjectKey = "conversation:test-minute";
  assert.equal(limiter.checkAndConsume({ subjectKey, now: 0 }).allowed, true);
  assert.equal(limiter.checkAndConsume({ subjectKey, now: 1_000 }).allowed, true);

  const blocked = limiter.checkAndConsume({ subjectKey, now: 2_000 });
  assert.equal(blocked.allowed, false);
  if (blocked.allowed) {
    assert.fail("expected minute limit to block");
  }
  assert.equal(blocked.details.window, "minute");
  assert.equal(blocked.details.limit, 2);
});

test("in-memory chat rate limiter blocks requests after day limit is reached", () => {
  const limiter = new InMemoryChatRateLimiter({
    perMinute: 10,
    perDay: 2,
    logEnabled: false,
  });

  const subjectKey = "conversation:test-day";
  assert.equal(limiter.checkAndConsume({ subjectKey, now: 0 }).allowed, true);
  assert.equal(limiter.checkAndConsume({ subjectKey, now: 1_000 }).allowed, true);

  const blocked = limiter.checkAndConsume({ subjectKey, now: 2_000 });
  assert.equal(blocked.allowed, false);
  if (blocked.allowed) {
    assert.fail("expected day limit to block");
  }
  assert.equal(blocked.details.window, "day");
  assert.equal(blocked.details.limit, 2);
});

test("chat rate limit subject prefers conversation id and falls back to ip", () => {
  assert.equal(
    resolveChatRateLimitSubject({
      conversationId: "client-123",
      forwardedFor: "203.0.113.1",
    }),
    "conversation:client-123",
  );

  assert.equal(
    resolveChatRateLimitSubject({
      forwardedFor: "203.0.113.1, 198.51.100.2",
    }),
    "ip:203.0.113.1",
  );
});
