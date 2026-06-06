"use strict";

process.env.NODE_ENV = "test";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  musicComponentHandler,
} = require("../src/handlers/musicComponentHandler");
const { MUSIC_CONTROL_IDS } = require("../src/utils/musicComponents");

function makeInteraction({
  customId = MUSIC_CONTROL_IDS.PAUSE,
  musicManager = null,
  userVoiceId = "voice-1",
  botVoiceId = "voice-1",
} = {}) {
  const calls = {
    deferUpdate: 0,
    followUp: [],
    editReply: [],
    reply: [],
  };

  const interaction = {
    customId,
    guildId: "guild-1",
    guildLocale: "en-US",
    locale: "en-US",
    deferred: false,
    replied: false,
    user: { id: "user-1" },
    member: { voice: { channelId: userVoiceId } },
    guild: {
      members: {
        me: { voice: { channelId: botVoiceId } },
        cache: new Map(),
      },
    },
    client: { musicManager },
    isButton: () => true,
    async deferUpdate() {
      calls.deferUpdate++;
      this.deferred = true;
    },
    async followUp(payload) {
      calls.followUp.push(payload);
    },
    async editReply(payload) {
      calls.editReply.push(payload);
    },
    async reply(payload) {
      calls.reply.push(payload);
    },
    __calls: calls,
  };

  return interaction;
}

describe("musicComponentHandler acknowledgements", () => {
  it("acknowledges once and uses an ephemeral follow-up when music is unavailable", async () => {
    const interaction = makeInteraction();

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.followUp.length, 1);
    assert.equal(interaction.__calls.followUp[0].flags, 64);
    assert.equal(interaction.__calls.reply.length, 0);
    assert.equal(interaction.__calls.editReply.length, 0);
  });

  it("acknowledges unknown music controls without a second initial reply", async () => {
    const interaction = makeInteraction({
      customId: "music:control:unknown",
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.followUp.length, 1);
    assert.equal(interaction.__calls.reply.length, 0);
  });

  it("ignores components outside the music namespace", async () => {
    const interaction = makeInteraction({ customId: "ticket:close" });

    assert.equal(await musicComponentHandler(interaction), false);
    assert.equal(interaction.__calls.deferUpdate, 0);
    assert.equal(interaction.__calls.followUp.length, 0);
  });

  it("updates the original message once after a valid pause action", async () => {
    const player = {
      voiceId: "voice-1",
      paused: false,
      position: 30000,
      volume: 80,
      loop: "none",
      queue: {
        current: {
          title: "Test track",
          author: "Test artist",
          sourceName: "youtube",
          length: 180000,
        },
        size: 1,
      },
      pause(value) {
        this.paused = value;
      },
    };
    const musicManager = {
      kazagumo: {
        players: new Map([["guild-1", player]]),
      },
    };
    const interaction = makeInteraction({ musicManager });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(player.paused, true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.editReply.length, 1);
    assert.equal(interaction.__calls.followUp.length, 0);
    assert.equal(interaction.__calls.reply.length, 0);
    assert.equal(interaction.__calls.editReply[0].components.length, 2);
  });
});
