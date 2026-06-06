"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_CUSTOM_ID_LENGTH,
  QUEUE_ACTIONS,
  QUEUE_PAGE_SIZE,
  createQueueCustomId,
  createQueueSessionId,
  getQueuePagination,
  getQueueTrackCount,
  isQueueSessionCurrent,
  paginateQueue,
  parseQueueCustomId,
} = require("../src/utils/musicQueuePagination");

const OWNER_ID = "111111111111111111";
const CREATED_AT = 1700000000000;
const SESSION_ID = CREATED_AT.toString(36);

describe("music queue custom IDs", () => {
  it("creates and parses navigation and close IDs", () => {
    const previous = createQueueCustomId(
      QUEUE_ACTIONS.PREVIOUS,
      OWNER_ID,
      SESSION_ID,
      1
    );
    const next = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      SESSION_ID,
      2
    );
    const close = createQueueCustomId(
      QUEUE_ACTIONS.CLOSE,
      OWNER_ID,
      SESSION_ID
    );

    assert.equal(previous, `music:queue:prev:${OWNER_ID}:${SESSION_ID}:1`);
    assert.equal(next, `music:queue:next:${OWNER_ID}:${SESSION_ID}:2`);
    assert.equal(close, `music:queue:close:${OWNER_ID}:${SESSION_ID}`);
    assert.deepEqual(parseQueueCustomId(previous), {
      action: "prev",
      ownerId: OWNER_ID,
      sessionId: SESSION_ID,
      page: 1,
    });
    assert.deepEqual(parseQueueCustomId(next), {
      action: "next",
      ownerId: OWNER_ID,
      sessionId: SESSION_ID,
      page: 2,
    });
    assert.deepEqual(parseQueueCustomId(close), {
      action: "close",
      ownerId: OWNER_ID,
      sessionId: SESSION_ID,
      page: null,
    });
    assert.ok(previous.length <= MAX_CUSTOM_ID_LENGTH);
    assert.ok(next.length <= MAX_CUSTOM_ID_LENGTH);
    assert.ok(close.length <= MAX_CUSTOM_ID_LENGTH);
  });

  it("rejects malformed IDs, page zero, and negative pages", () => {
    const invalidIds = [
      "",
      "music:queue",
      `music:queue:other:${OWNER_ID}:${SESSION_ID}:1`,
      `music:queue:next:owner:${SESSION_ID}:1`,
      `music:queue:next:${OWNER_ID}:SESSION:1`,
      `music:queue:next:${OWNER_ID}:${SESSION_ID}:0`,
      `music:queue:next:${OWNER_ID}:${SESSION_ID}:-1`,
      `music:queue:next:${OWNER_ID}:${SESSION_ID}:1.5`,
      `music:queue:close:${OWNER_ID}:${SESSION_ID}:1`,
      `music:queue:next:${OWNER_ID}:${SESSION_ID}:9007199254740992`,
    ];

    for (const customId of invalidIds) {
      assert.equal(parseQueueCustomId(customId), null, customId);
    }
    assert.throws(
      () => createQueueCustomId(QUEUE_ACTIONS.NEXT, OWNER_ID, SESSION_ID, 0),
      TypeError
    );
    assert.throws(
      () => createQueueCustomId(QUEUE_ACTIONS.NEXT, OWNER_ID, SESSION_ID, -1),
      TypeError
    );
  });

  it("rejects IDs that reach Discord's 100-character limit", () => {
    const longSessionId = "a".repeat(80);
    assert.throws(
      () =>
        createQueueCustomId(
          QUEUE_ACTIONS.NEXT,
          OWNER_ID,
          longSessionId,
          1
        ),
      RangeError
    );
    assert.equal(
      parseQueueCustomId(
        `music:queue:next:${OWNER_ID}:${longSessionId}:1`
      ),
      null
    );
  });

  it("creates a stable base-36 session from player.createdAt", () => {
    const player = { createdAt: CREATED_AT };
    assert.equal(createQueueSessionId(player), SESSION_ID);
    assert.equal(isQueueSessionCurrent(player, SESSION_ID), true);
    assert.equal(isQueueSessionCurrent(player, "old"), false);
    assert.equal(createQueueSessionId({}), "0");
  });
});

describe("music queue pagination", () => {
  it("uses ten tracks per page and clamps page zero or negative to page one", () => {
    assert.equal(QUEUE_PAGE_SIZE, 10);
    assert.equal(getQueuePagination(25, 0).page, 1);
    assert.equal(getQueuePagination(25, -3).page, 1);

    const page = paginateQueue(
      Array.from({ length: 25 }, (_, index) => index + 1),
      2
    );
    assert.equal(page.tracks.length, 10);
    assert.deepEqual(page.tracks, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("clamps pages above the maximum and disables navigation for an empty queue", () => {
    const highPage = getQueuePagination(12, 99);
    assert.equal(highPage.page, 2);
    assert.equal(highPage.totalPages, 2);
    assert.equal(highPage.nextDisabled, true);

    const empty = getQueuePagination(0, 4);
    assert.equal(empty.page, 1);
    assert.equal(empty.totalPages, 1);
    assert.equal(empty.previousDisabled, true);
    assert.equal(empty.nextDisabled, true);
  });

  it("adjusts the active page when the queue shrinks", () => {
    const before = getQueuePagination(25, 3);
    const after = getQueuePagination(12, before.page);

    assert.equal(before.page, 3);
    assert.equal(before.totalPages, 3);
    assert.equal(after.page, 2);
    assert.equal(after.totalPages, 2);
  });

  it("exposes new pages when the queue grows", () => {
    const before = getQueuePagination(8, 1);
    const after = getQueuePagination(25, 2);

    assert.equal(before.totalPages, 1);
    assert.equal(before.nextDisabled, true);
    assert.equal(after.page, 2);
    assert.equal(after.totalPages, 3);
    assert.equal(after.nextDisabled, false);
  });

  it("counts iterable and queue.tracks representations safely", () => {
    assert.equal(getQueueTrackCount([1, 2, 3]), 3);
    assert.equal(getQueueTrackCount({ tracks: [1, 2] }), 2);
    assert.equal(getQueueTrackCount({ size: 4 }), 4);
    assert.equal(getQueueTrackCount(null), 0);
  });
});
