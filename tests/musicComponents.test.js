"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { ButtonStyle } = require("discord.js");

const {
  MUSIC_CONTROL_IDS,
  createPlayerControls,
  createQueuePaginationControls,
  isMusicControlId,
} = require("../src/utils/musicComponents");
const { parseQueueCustomId } = require("../src/utils/musicQueuePagination");

const OWNER_ID = "111111111111111111";
const SESSION_ID = "loyw3v28";

function makePlayer(overrides = {}) {
  return {
    paused: false,
    queue: {
      current: { title: "Current track" },
      size: 3,
    },
    ...overrides,
  };
}

function buttonData(rows) {
  return rows.flatMap((row) => row.toJSON().components);
}

describe("music player controls", () => {
  it("uses the centralized custom IDs in two rows", () => {
    const rows = createPlayerControls(makePlayer(), "pro", "en");
    const buttons = buttonData(rows);

    assert.equal(rows.length, 2);
    assert.equal(rows[0].components.length, 3);
    assert.equal(rows[1].components.length, 4);
    assert.deepEqual(
      buttons.map((button) => button.custom_id),
      Object.values(MUSIC_CONTROL_IDS)
    );
    for (const customId of Object.values(MUSIC_CONTROL_IDS)) {
      assert.equal(isMusicControlId(customId), true);
    }
    assert.equal(isMusicControlId("music:control:unknown"), false);
  });

  it("applies primary, danger, and secondary button styles", () => {
    const buttons = buttonData(createPlayerControls(makePlayer(), "pro", "en"));
    const byId = new Map(buttons.map((button) => [button.custom_id, button]));

    assert.equal(byId.get(MUSIC_CONTROL_IDS.PAUSE).style, ButtonStyle.Primary);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.SKIP).style, ButtonStyle.Primary);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.STOP).style, ButtonStyle.Danger);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.LOOP).style, ButtonStyle.Secondary);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.SHUFFLE).style, ButtonStyle.Secondary);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.QUEUE).style, ButtonStyle.Secondary);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.VOLUME).style, ButtonStyle.Secondary);
  });

  it("disables queue actions when there are no pending tracks", () => {
    const player = makePlayer({
      queue: { current: { title: "Current track" }, size: 0 },
    });
    const buttons = buttonData(createPlayerControls(player, "pro", "en"));
    const byId = new Map(buttons.map((button) => [button.custom_id, button]));

    assert.equal(byId.get(MUSIC_CONTROL_IDS.QUEUE).disabled, true);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.SHUFFLE).disabled, true);
    assert.equal(byId.get(MUSIC_CONTROL_IDS.PAUSE).disabled, false);
  });

  it("disables PRO shuffle for FREE players", () => {
    const buttons = buttonData(createPlayerControls(makePlayer(), "free", "en"));
    const shuffle = buttons.find(
      (button) => button.custom_id === MUSIC_CONTROL_IDS.SHUFFLE
    );

    assert.equal(shuffle.disabled, true);
  });

  it("shows resume while paused and can disable every control", () => {
    const pausedButtons = buttonData(
      createPlayerControls(makePlayer({ paused: true }), "pro", "en")
    );
    const pause = pausedButtons.find(
      (button) => button.custom_id === MUSIC_CONTROL_IDS.PAUSE
    );
    assert.equal(pause.label, "Resume");

    const disabledButtons = buttonData(
      createPlayerControls(null, "free", "en", { disabled: true })
    );
    assert.ok(disabledButtons.every((button) => button.disabled));
  });
});

describe("music queue pagination controls", () => {
  it("creates previous, next, and close buttons with safe IDs", () => {
    const rows = createQueuePaginationControls({
      ownerId: OWNER_ID,
      sessionId: SESSION_ID,
      page: 2,
      totalItems: 25,
      language: "en",
    });
    const buttons = buttonData(rows);

    assert.equal(rows.length, 1);
    assert.equal(buttons.length, 3);
    assert.deepEqual(
      buttons.map((button) => parseQueueCustomId(button.custom_id).action),
      ["prev", "next", "close"]
    );
    assert.equal(parseQueueCustomId(buttons[0].custom_id).page, 1);
    assert.equal(parseQueueCustomId(buttons[1].custom_id).page, 3);
    assert.equal(buttons[0].disabled, false);
    assert.equal(buttons[1].disabled, false);
    assert.equal(buttons[2].style, ButtonStyle.Danger);
  });

  it("disables navigation at boundaries while keeping close enabled", () => {
    const firstPage = buttonData(
      createQueuePaginationControls({
        ownerId: OWNER_ID,
        sessionId: SESSION_ID,
        page: 1,
        totalItems: 15,
      })
    );
    assert.equal(firstPage[0].disabled, true);
    assert.equal(firstPage[1].disabled, false);
    assert.notEqual(firstPage[2].disabled, true);

    const empty = buttonData(
      createQueuePaginationControls({
        ownerId: OWNER_ID,
        sessionId: SESSION_ID,
        page: 1,
        totalItems: 0,
      })
    );
    assert.equal(empty[0].disabled, true);
    assert.equal(empty[1].disabled, true);
    assert.notEqual(empty[2].disabled, true);
  });
});
