"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  CONTROL_ERROR_CODES,
  MusicControlError,
  MusicControlService,
} = require("../src/services/MusicControlService");

function makePlayer(overrides = {}) {
  const queue = {
    current: { title: "Current track" },
    size: 2,
    shuffleCalls: 0,
    shuffle() {
      this.shuffleCalls++;
    },
  };

  return {
    voiceId: "voice-1",
    paused: false,
    loop: "none",
    queue,
    pauseCalls: [],
    skipCalls: 0,
    loopCalls: [],
    volumeCalls: [],
    pause(value) {
      this.paused = value;
      this.pauseCalls.push(value);
    },
    skip() {
      this.skipCalls++;
    },
    setLoop(value) {
      this.loop = value;
      this.loopCalls.push(value);
    },
    async setVolume(value) {
      this.volumeCalls.push(value);
    },
    ...overrides,
  };
}

function makeInteraction({ userVoiceId = "voice-1", botVoiceId = "voice-1" } = {}) {
  const userMember = { voice: { channelId: userVoiceId } };
  return {
    user: { id: "user-1" },
    member: userMember,
    guild: {
      members: {
        me: { voice: { channelId: botVoiceId } },
        cache: new Map([["user-1", userMember]]),
      },
    },
  };
}

function expectControlError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof MusicControlError);
    assert.equal(error.code, code);
    return true;
  });
}

describe("MusicControlService validation", () => {
  const service = new MusicControlService(null);

  it("rejects a missing player or track", () => {
    expectControlError(
      () => service.validateController(makeInteraction(), null),
      CONTROL_ERROR_CODES.NO_PLAYER
    );
    expectControlError(
      () => service.validateController(
        makeInteraction(),
        makePlayer({ queue: { current: null, size: 0 } })
      ),
      CONTROL_ERROR_CODES.NO_TRACK
    );
  });

  it("rejects users outside voice", () => {
    expectControlError(
      () => service.validateController(
        makeInteraction({ userVoiceId: null }),
        makePlayer()
      ),
      CONTROL_ERROR_CODES.USER_NOT_IN_VOICE
    );
  });

  it("rejects a disconnected bot and a different user channel", () => {
    expectControlError(
      () => service.validateController(
        makeInteraction({ botVoiceId: null }),
        makePlayer()
      ),
      CONTROL_ERROR_CODES.BOT_DISCONNECTED
    );
    expectControlError(
      () => service.validateController(
        makeInteraction({ userVoiceId: "voice-2" }),
        makePlayer()
      ),
      CONTROL_ERROR_CODES.DIFFERENT_VOICE_CHANNEL
    );
  });

  it("accepts a user and bot in the player voice channel", () => {
    assert.equal(
      service.validateController(makeInteraction(), makePlayer()),
      true
    );
  });

  it("rejects queue actions when no tracks are pending", () => {
    const player = makePlayer();
    player.queue.size = 0;
    expectControlError(
      () => service.validateController(
        makeInteraction(),
        player,
        { requireQueue: true }
      ),
      CONTROL_ERROR_CODES.QUEUE_EMPTY
    );
  });
});

describe("MusicControlService actions", () => {
  it("toggles pause and loop without changing tier limits", () => {
    const player = makePlayer();
    const service = new MusicControlService(null);

    assert.equal(service.togglePause(player), true);
    assert.equal(service.togglePause(player), false);
    assert.deepEqual(player.pauseCalls, [true, false]);

    assert.equal(service.toggleLoop(player, "free"), "track");
    assert.equal(service.toggleLoop(player, "free"), "none");
    assert.equal(service.toggleLoop(player, "pro"), "track");
    assert.equal(service.toggleLoop(player, "pro"), "queue");
  });

  it("reuses player operations for skip, shuffle, volume, and stop", async () => {
    let destroyedGuild = null;
    const manager = {
      async destroyPlayer(guildId) {
        destroyedGuild = guildId;
      },
    };
    const player = makePlayer();
    const service = new MusicControlService(manager);

    assert.equal(service.skipCurrent(player).title, "Current track");
    assert.equal(player.skipCalls, 1);
    assert.equal(service.shuffleQueue(player), 2);
    assert.equal(player.queue.shuffleCalls, 1);
    await service.setVolume(player, 80);
    assert.deepEqual(player.volumeCalls, [80]);
    await service.stop("guild-1");
    assert.equal(destroyedGuild, "guild-1");
  });

  it("returns the player volume promise and propagates Lavalink failures", async () => {
    const service = new MusicControlService(null);
    let resolveVolume;
    const expectedPlayer = { id: "player-1" };
    const player = {
      setVolume() {
        return new Promise((resolve) => {
          resolveVolume = resolve;
        });
      },
    };

    const pending = service.setVolume(player, 80);
    let settled = false;
    pending.finally(() => {
      settled = true;
    });

    await Promise.resolve();
    assert.equal(settled, false);
    resolveVolume(expectedPlayer);
    assert.equal(await pending, expectedPlayer);

    const failure = new Error("Lavalink volume update failed");
    const failingPlayer = {
      setVolume() {
        return Promise.reject(failure);
      },
    };
    await assert.rejects(service.setVolume(failingPlayer, 80), failure);
  });
});
