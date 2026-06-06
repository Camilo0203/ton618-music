"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { ButtonStyle } = require("discord.js");

const {
  MUSIC_CONTROL_IDS,
  createPlayerControls,
  isMusicControlId,
} = require("../src/utils/musicComponents");

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
