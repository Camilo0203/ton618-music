"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { commands } = require("../src/handlers/musicInteractionHandler");

test("loads and serializes every music command", () => {
  const expectedCommands = [
    "filter",
    "loop",
    "musicstatus",
    "nowplaying",
    "pause",
    "play",
    "queue",
    "search",
    "shuffle",
    "skip",
    "stop",
    "volume",
  ];

  assert.deepEqual([...commands.keys()].sort(), expectedCommands);

  for (const command of commands.values()) {
    assert.doesNotThrow(() => command.data.toJSON(), command.data.name);
  }
});
