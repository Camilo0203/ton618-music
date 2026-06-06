"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { t } = require("./i18n");
const {
  QUEUE_ACTIONS,
  createQueueCustomId,
  getQueuePagination,
} = require("./musicQueuePagination");

const MUSIC_CONTROL_IDS = Object.freeze({
  PAUSE: "music:control:pause",
  SKIP: "music:control:skip",
  STOP: "music:control:stop",
  LOOP: "music:control:loop",
  SHUFFLE: "music:control:shuffle",
  QUEUE: "music:control:queue",
  VOLUME: "music:control:volume",
});

const MUSIC_CONTROL_ID_SET = new Set(Object.values(MUSIC_CONTROL_IDS));

function isMusicControlId(customId) {
  return MUSIC_CONTROL_ID_SET.has(customId);
}

function createPlayerControls(player, tier = "free", language = "en", options = {}) {
  const forceDisabled = Boolean(options.disabled);
  const hasTrack = Boolean(player?.queue?.current);
  const queueSize = Math.max(0, Number(player?.queue?.size) || 0);
  const controlsDisabled = forceDisabled || !hasTrack;

  const primaryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.PAUSE)
      .setLabel(player?.paused ? t(language, "button_resume") : t(language, "button_pause"))
      .setEmoji("\u23EF\uFE0F")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(controlsDisabled),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.SKIP)
      .setLabel(t(language, "button_skip"))
      .setEmoji("\u23ED\uFE0F")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(controlsDisabled),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.STOP)
      .setLabel(t(language, "button_stop"))
      .setEmoji("\u23F9\uFE0F")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(controlsDisabled)
  );

  const secondaryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.LOOP)
      .setLabel(t(language, "button_loop"))
      .setEmoji("\uD83D\uDD01")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(controlsDisabled),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.SHUFFLE)
      .setLabel(t(language, "button_shuffle"))
      .setEmoji("\uD83D\uDD00")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(controlsDisabled || tier !== "pro" || queueSize < 2),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.QUEUE)
      .setLabel(t(language, "button_queue"))
      .setEmoji("\uD83D\uDCDC")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(forceDisabled || queueSize === 0),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_IDS.VOLUME)
      .setLabel(t(language, "button_volume"))
      .setEmoji("\uD83D\uDD0A")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(controlsDisabled)
  );

  return [primaryRow, secondaryRow];
}

function createQueuePaginationControls({
  ownerId,
  sessionId,
  page = 1,
  totalItems = 0,
  language = "en",
}) {
  const pagination = getQueuePagination(totalItems, page);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(
        createQueueCustomId(
          QUEUE_ACTIONS.PREVIOUS,
          ownerId,
          sessionId,
          pagination.previousPage
        )
      )
      .setLabel(t(language, "queue_previous"))
      .setEmoji("\u25C0\uFE0F")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pagination.previousDisabled),
    new ButtonBuilder()
      .setCustomId(
        createQueueCustomId(
          QUEUE_ACTIONS.NEXT,
          ownerId,
          sessionId,
          pagination.nextPage
        )
      )
      .setLabel(t(language, "queue_next"))
      .setEmoji("\u25B6\uFE0F")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(pagination.nextDisabled),
    new ButtonBuilder()
      .setCustomId(
        createQueueCustomId(QUEUE_ACTIONS.CLOSE, ownerId, sessionId)
      )
      .setLabel(t(language, "queue_close"))
      .setEmoji("\u2716\uFE0F")
      .setStyle(ButtonStyle.Danger)
  );

  return [row];
}

module.exports = {
  MUSIC_CONTROL_IDS,
  createPlayerControls,
  createQueuePaginationControls,
  isMusicControlId,
};
