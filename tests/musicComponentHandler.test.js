"use strict";

process.env.NODE_ENV = "test";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  musicComponentHandler,
} = require("../src/handlers/musicComponentHandler");
const { MUSIC_CONTROL_IDS } = require("../src/utils/musicComponents");
const {
  QUEUE_ACTIONS,
  createQueueCustomId,
  createQueueSessionId,
  parseQueueCustomId,
} = require("../src/utils/musicQueuePagination");

const OWNER_ID = "111111111111111111";
const OTHER_USER_ID = "222222222222222222";
const CREATED_AT = 1700000000000;

function makeInteraction({
  customId = MUSIC_CONTROL_IDS.PAUSE,
  musicManager = null,
  userId = "user-1",
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
    user: { id: userId },
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

function makeTrack(index = 1) {
  return {
    title: `Track ${index}`,
    author: `Artist ${index}`,
    sourceName: "youtube",
    length: 180000,
    uri: `https://example.com/${index}`,
  };
}

function makeQueue(count) {
  const queue = Array.from({ length: count }, (_, index) => makeTrack(index + 1));
  queue.current = makeTrack(99);
  Object.defineProperty(queue, "size", {
    configurable: true,
    get() {
      return this.length;
    },
  });
  return queue;
}

function makeQueuePlayer(count, overrides = {}) {
  return {
    voiceId: "voice-1",
    paused: false,
    position: 30000,
    volume: 80,
    loop: "none",
    createdAt: CREATED_AT,
    queue: makeQueue(count),
    ...overrides,
  };
}

function makeMusicManager(player) {
  return {
    kazagumo: {
      players: new Map(player ? [["guild-1", player]] : []),
    },
  };
}

function paginationButtons(payload) {
  return payload.components[0].toJSON().components;
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

describe("music queue component pagination", () => {
  it("opens an ephemeral paginated queue from the player control", async () => {
    const player = makeQueuePlayer(15);
    const interaction = makeInteraction({
      customId: MUSIC_CONTROL_IDS.QUEUE,
      musicManager: makeMusicManager(player),
      userId: OWNER_ID,
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.followUp.length, 1);
    assert.equal(interaction.__calls.followUp[0].flags, 64);
    assert.equal(interaction.__calls.followUp[0].components.length, 1);
    assert.equal(paginationButtons(interaction.__calls.followUp[0]).length, 3);
  });

  it("allows the owner to navigate while outside voice", async () => {
    const player = makeQueuePlayer(15);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      createQueueSessionId(player),
      2
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OWNER_ID,
      userVoiceId: null,
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.editReply.length, 1);
    assert.equal(interaction.__calls.followUp.length, 0);
    const embed = interaction.__calls.editReply[0].embeds[0].toJSON();
    assert.match(embed.footer.text, /Page 2\/2/);
  });

  it("allows another user in the active player voice channel", async () => {
    const player = makeQueuePlayer(15);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      createQueueSessionId(player),
      2
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OTHER_USER_ID,
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.editReply.length, 1);
    assert.equal(interaction.__calls.followUp.length, 0);
  });

  it("rejects a non-owner outside the active voice channel", async () => {
    const player = makeQueuePlayer(15);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      createQueueSessionId(player),
      2
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OTHER_USER_ID,
      userVoiceId: "voice-2",
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.followUp.length, 1);
    assert.equal(interaction.__calls.followUp[0].flags, 64);
    assert.equal(interaction.__calls.editReply.length, 0);
  });

  it("removes components when the playback session is stale", async () => {
    const player = makeQueuePlayer(15);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      "oldsession",
      2
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OWNER_ID,
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.editReply.length, 1);
    assert.deepEqual(interaction.__calls.editReply[0].components, []);
    const embed = interaction.__calls.editReply[0].embeds[0].toJSON();
    assert.match(embed.description, /old playback session/i);
  });

  it("handles a deleted player as an expired owner session", async () => {
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      CREATED_AT.toString(36),
      2
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(null),
      userId: OWNER_ID,
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.editReply.length, 1);
    assert.deepEqual(interaction.__calls.editReply[0].components, []);
  });

  it("closes the queue by editing away components without deleting the message", async () => {
    const player = makeQueuePlayer(15);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.CLOSE,
      OWNER_ID,
      createQueueSessionId(player)
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OWNER_ID,
    });

    assert.equal(await musicComponentHandler(interaction), true);
    assert.equal(interaction.__calls.deferUpdate, 1);
    assert.equal(interaction.__calls.editReply.length, 1);
    assert.deepEqual(interaction.__calls.editReply[0], { components: [] });
  });

  it("clamps the requested page after the queue decreases", async () => {
    const player = makeQueuePlayer(12);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      createQueueSessionId(player),
      3
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OWNER_ID,
    });

    await musicComponentHandler(interaction);
    assert.equal(interaction.__calls.deferUpdate, 1);
    const payload = interaction.__calls.editReply[0];
    assert.match(payload.embeds[0].toJSON().footer.text, /Page 2\/2/);
    assert.equal(parseQueueCustomId(paginationButtons(payload)[0].custom_id).page, 1);
    assert.equal(paginationButtons(payload)[1].disabled, true);
  });

  it("recalculates navigation when the queue grows", async () => {
    const player = makeQueuePlayer(25);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      createQueueSessionId(player),
      2
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OWNER_ID,
    });

    await musicComponentHandler(interaction);
    assert.equal(interaction.__calls.deferUpdate, 1);
    const payload = interaction.__calls.editReply[0];
    assert.match(payload.embeds[0].toJSON().footer.text, /Page 2\/3/);
    assert.equal(parseQueueCustomId(paginationButtons(payload)[1].custom_id).page, 3);
    assert.equal(paginationButtons(payload)[1].disabled, false);
  });

  it("shows an empty queue with disabled navigation", async () => {
    const player = makeQueuePlayer(0);
    const customId = createQueueCustomId(
      QUEUE_ACTIONS.NEXT,
      OWNER_ID,
      createQueueSessionId(player),
      2
    );
    const interaction = makeInteraction({
      customId,
      musicManager: makeMusicManager(player),
      userId: OWNER_ID,
    });

    await musicComponentHandler(interaction);
    assert.equal(interaction.__calls.deferUpdate, 1);
    const payload = interaction.__calls.editReply[0];
    const buttons = paginationButtons(payload);
    assert.equal(buttons[0].disabled, true);
    assert.equal(buttons[1].disabled, true);
    assert.notEqual(buttons[2].disabled, true);
    assert.match(payload.embeds[0].toJSON().description, /no more songs/i);
  });
});
