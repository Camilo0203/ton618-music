"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const { TIER_LIMITS } = require("../src/config/lavalinkConfig");

describe("TIER_LIMITS", () => {
  it("FREE tier has lower maxQueue than PRO", () => {
    assert.ok(TIER_LIMITS.free.maxQueue < TIER_LIMITS.pro.maxQueue);
  });

  it("FREE tier has lower maxVolume than PRO", () => {
    assert.ok(TIER_LIMITS.free.maxVolume <= TIER_LIMITS.pro.maxVolume);
  });

  it("FREE tier has lower maxDurationSeconds than PRO", () => {
    assert.ok(TIER_LIMITS.free.maxDurationSeconds < TIER_LIMITS.pro.maxDurationSeconds);
  });

  it("FREE tier has filters disabled", () => {
    assert.strictEqual(TIER_LIMITS.free.filters, false);
  });

  it("PRO tier has filters enabled", () => {
    assert.strictEqual(TIER_LIMITS.pro.filters, true);
  });

  it("FREE tier has spotify disabled", () => {
    assert.strictEqual(TIER_LIMITS.free.spotifyEnabled, false);
  });

  it("PRO tier has spotify enabled", () => {
    assert.strictEqual(TIER_LIMITS.pro.spotifyEnabled, true);
  });

  it("FREE tier has playlist disabled", () => {
    assert.strictEqual(TIER_LIMITS.free.playlistEnabled, false);
  });

  it("PRO tier has playlist enabled", () => {
    assert.strictEqual(TIER_LIMITS.pro.playlistEnabled, true);
  });

  it("FREE tier has lower bitrate than PRO", () => {
    assert.ok(TIER_LIMITS.free.bitrate < TIER_LIMITS.pro.bitrate);
  });
});
