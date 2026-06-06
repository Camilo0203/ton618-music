"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  BRAND_NAME,
  COLORS,
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
  createNowPlayingEmbed,
  createProgressBar,
  createQueueEmbed,
  formatDuration,
  formatLoop,
  formatSource,
  truncate,
  nowPlayingEmbed,
  queueEmbed,
  errorEmbed,
  warningEmbed,
} = require("../src/utils/musicEmbeds");

function makeTrack(index = 1, overrides = {}) {
  return {
    title: `Track ${index}`,
    uri: `https://example.com/tracks/${index}`,
    author: `Artist ${index}`,
    sourceName: "youtube",
    length: 180000,
    thumbnail: "https://example.com/artwork.jpg",
    requester: { tag: "Listener#0001" },
    ...overrides,
  };
}

describe("music embed formatters", () => {
  it("formats durations and live streams safely", () => {
    assert.equal(formatDuration(65000), "1:05");
    assert.equal(formatDuration(3661000), "1:01:01");
    assert.equal(formatDuration(0), "LIVE");
    assert.equal(formatDuration(undefined), "LIVE");
  });

  it("formats known and unknown sources", () => {
    assert.equal(formatSource("youtube"), "YouTube");
    assert.equal(formatSource("soundcloud"), "SoundCloud");
    assert.equal(formatSource("customSource"), "CustomSource");
    assert.equal(formatSource("http", "en"), "Direct link");
    assert.equal(formatSource("", "es"), "Desconocido");
  });

  it("formats loop modes in the selected language", () => {
    assert.equal(formatLoop("track", "es"), "Pista");
    assert.equal(formatLoop("queue", "en"), "Queue");
    assert.equal(formatLoop("none", "es"), "Desactivada");
  });

  it("truncates long text without exceeding the requested length", () => {
    const result = truncate("A very long track title", 10);
    assert.equal(result.length, 10);
    assert.match(result, /…$/);
  });

  it("creates a bounded progress bar", () => {
    const progress = createProgressBar(90000, 180000, 10);
    assert.match(progress, /1:30/);
    assert.match(progress, /3:00/);
    assert.equal((progress.match(/●/g) || []).length, 1);
    assert.equal(createProgressBar(0, 0), "`0:00` • LIVE");
  });
});

describe("premium music embeds", () => {
  it("builds a complete now-playing embed", () => {
    const track = makeTrack();
    const player = {
      paused: false,
      position: 90000,
      volume: 72,
      loop: "track",
      queue: { size: 3 },
    };

    const json = createNowPlayingEmbed(track, player, "pro", "es").toJSON();

    assert.equal(json.color, COLORS.PLAYING);
    assert.equal(json.title, track.title);
    assert.equal(json.url, track.uri);
    assert.equal(json.thumbnail.url, track.thumbnail);
    assert.match(json.description, /1:30/);
    assert.match(json.footer.text, new RegExp(BRAND_NAME));
    assert.match(json.footer.text, /Listener#0001/);
    assert.ok(json.fields.some((field) => field.name === "Fuente" && field.value === "YouTube"));
    assert.ok(json.fields.some((field) => field.name === "Volumen" && field.value === "72%"));
    assert.ok(json.fields.some((field) => field.name === "Repetición" && field.value === "Pista"));
  });

  it("uses the paused state color", () => {
    const json = createNowPlayingEmbed(
      makeTrack(),
      { paused: true, position: 0, volume: 80, loop: "none", queue: { size: 0 } },
      "free",
      "en"
    ).toJSON();

    assert.equal(json.color, COLORS.PAUSED);
    assert.match(json.author.name, /paused/i);
  });

  it("shows at most ten upcoming tracks per queue page", () => {
    const queue = Array.from({ length: 12 }, (_, index) => makeTrack(index + 1));
    queue.current = makeTrack(99, { title: "Current Track" });
    const player = {
      paused: false,
      position: 60000,
      queue,
    };

    const firstPage = createQueueEmbed(player, "pro", 1, "en").toJSON();
    const secondPage = createQueueEmbed(player, "pro", 2, "en").toJSON();

    assert.equal((firstPage.description.match(/^\*\*\d+\.\*\*/gm) || []).length, 10);
    assert.equal((secondPage.description.match(/^\*\*\d+\.\*\*/gm) || []).length, 2);
    assert.match(firstPage.fields[0].value, /Current Track/);
    assert.match(firstPage.footer.text, /Page 1\/2/);
    assert.match(firstPage.footer.text, /13 tracks/);
    assert.ok(firstPage.fields.some((field) => field.name === "Approx. duration"));
  });

  it("clamps a stale page after the queue shrinks and handles an empty queue", () => {
    const queue = Array.from({ length: 12 }, (_, index) => makeTrack(index + 1));
    queue.current = makeTrack(99, { title: "Current Track" });
    const player = { paused: false, position: 0, queue };

    const clamped = createQueueEmbed(player, "free", 9, "en").toJSON();
    assert.match(clamped.footer.text, /Page 2\/2/);
    assert.equal((clamped.description.match(/^\*\*\d+\.\*\*/gm) || []).length, 2);

    queue.splice(0);
    const empty = createQueueEmbed(player, "free", 2, "es").toJSON();
    assert.match(empty.footer.text, /PÃ¡gina 1\/1|Página 1\/1/);
    assert.match(empty.description, /No hay mÃ¡s canciones|No hay más canciones/);
  });

  it("applies consistent status colors and branding", () => {
    const error = createMusicErrorEmbed("Failure", "en").toJSON();
    const success = createMusicSuccessEmbed("Done", "Completed", { language: "en" }).toJSON();
    const warning = createMusicWarningEmbed("Careful", "free", "en").toJSON();

    assert.equal(error.color, COLORS.ERROR);
    assert.equal(success.color, COLORS.SUCCESS);
    assert.equal(warning.color, COLORS.WARNING);
    assert.equal(error.footer.text, BRAND_NAME);
    assert.equal(success.footer.text, BRAND_NAME);
    assert.match(warning.footer.text, new RegExp(`^${BRAND_NAME}`));
  });

  it("keeps legacy exports compatible", () => {
    assert.equal(nowPlayingEmbed, createNowPlayingEmbed);
    assert.equal(queueEmbed, createQueueEmbed);
    assert.equal(errorEmbed, createMusicErrorEmbed);
    assert.equal(warningEmbed, createMusicWarningEmbed);
  });
});
