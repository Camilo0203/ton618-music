"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_PRO_STORE_URL,
  getProStoreUrl,
} = require("../src/utils/proStore");

test("uses the official Tebex store by default", () => {
  assert.equal(getProStoreUrl({}), DEFAULT_PRO_STORE_URL);
});

test("prefers TEBEX_STORE_URL over the legacy upgrade variable", () => {
  assert.equal(
    getProStoreUrl({
      TEBEX_STORE_URL: "https://custom-store.example.com/",
      PRO_UPGRADE_URL: "https://legacy.example.com/",
    }),
    "https://custom-store.example.com/"
  );
});

test("rejects Discord invite URLs as a purchase destination", () => {
  assert.equal(
    getProStoreUrl({ PRO_UPGRADE_URL: "https://discord.gg/ton618" }),
    DEFAULT_PRO_STORE_URL
  );
});

test("keeps valid legacy HTTPS purchase URLs compatible", () => {
  assert.equal(
    getProStoreUrl({ PRO_UPGRADE_URL: "https://billing.example.com/pro" }),
    "https://billing.example.com/pro"
  );
});
