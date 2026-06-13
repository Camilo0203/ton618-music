"use strict";

process.env.NODE_ENV = "test";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { TrackErrorHandler } = require("../src/services/TrackErrorHandler");
const { CIRCUIT_BREAKER, TIMEOUTS } = require("../src/config/lavalinkConfig");

describe("TrackErrorHandler", () => {
  // TrackErrorHandler requiere musicManager y nodeHealthMonitor en constructor
  const dummyHealth = { recordFailure: () => {} };
  const handler = new TrackErrorHandler(null, dummyHealth);

  it("classifies 403 errors as skip (bot_block)", () => {
    const err = { message: "Status code: 403" };
    const result = handler.classifyError(err);
    assert.strictEqual(result.action, "skip");
    assert.strictEqual(result.reason, "youtube_403_or_antibot");
  });

  it("classifies sign_in errors as skip (bot_block)", () => {
    const err = { message: "Sign in to confirm you are not a bot" };
    const result = handler.classifyError(err);
    assert.strictEqual(result.action, "skip");
    assert.strictEqual(result.reason, "youtube_403_or_antibot");
  });

  it("classifies URL expired as retry", () => {
    const err = { message: "URL signature expired" };
    const result = handler.classifyError(err);
    assert.strictEqual(result.action, "retry");
    assert.strictEqual(result.reason, "url_expired");
    assert.ok(result.delayMs > 0);
  });

  it("classifies network errors as retry", () => {
    const err = { message: "ECONNRESET" };
    const result = handler.classifyError(err);
    assert.strictEqual(result.action, "retry");
    assert.strictEqual(result.reason, "network_error");
  });

  it("classifies unknown errors as skip", () => {
    const err = { message: "Something went wrong" };
    const result = handler.classifyError(err);
    assert.strictEqual(result.action, "skip");
    assert.strictEqual(result.reason, "unknown_error");
  });
});

describe("Config constants", () => {
  it("CIRCUIT_BREAKER has positive threshold", () => {
    assert.ok(CIRCUIT_BREAKER.threshold > 0);
  });

  it("CIRCUIT_BREAKER has positive resetMs", () => {
    assert.ok(CIRCUIT_BREAKER.resetMs > 0);
  });

  it("TIMEOUTS has positive playerIdle", () => {
    assert.ok(TIMEOUTS.playerIdle > 0);
  });

  it("TIMEOUTS has positive trackMaxRetries", () => {
    assert.ok(TIMEOUTS.trackMaxRetries >= 0);
  });

  it("TIMEOUTS has positive tierResolve", () => {
    assert.ok(TIMEOUTS.tierResolve > 0);
  });
});
