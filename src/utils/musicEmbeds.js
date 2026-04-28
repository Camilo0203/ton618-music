"use strict";

/**
 * Embeds de música para respuestas de Discord
 */

const { EmbedBuilder } = require("discord.js");
const { t } = require("./i18n");

const COLOR_PRO = 0x5865f2;   // Blurple — tier PRO
const COLOR_FREE = 0x57f287;  // Verde — tier FREE
const COLOR_ERROR = 0xed4245;
const COLOR_WARNING = 0xfee75c;

function tierColor(tier) {
  return tier === "pro" ? COLOR_PRO : COLOR_FREE;
}

function tierBadge(tier, language = "en") {
  return tier === "pro" ? t(language, "tier_badge_pro") : t(language, "tier_badge_free");
}

function formatDuration(ms) {
  if (!ms) return "∞";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function nowPlayingEmbed(track, player, tier, language = "en") {
  const embed = new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle(t(language, "now_playing_title"))
    .setDescription(`**[${track.title}](${track.uri})**`)
    .addFields(
      { name: t(language, "duration"), value: formatDuration(track.length), inline: true },
      { name: t(language, "author"), value: track.author || t(language, "unknown"), inline: true },
      { name: t(language, "remaining_queue"), value: `${player.queue.size} ${t(language, "tracks")}`, inline: true }
    )
    .setFooter({ text: `${tierBadge(tier, language)} · ${t(language, "requested_by")} ${track.requester?.tag || t(language, "unknown")}` });

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

function addedToQueueEmbed(track, position, tier, language = "en") {
  return new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle(t(language, "added_to_queue_title"))
    .setDescription(`**[${track.title}](${track.uri})**`)
    .addFields(
      { name: t(language, "queue_position"), value: `#${position}`, inline: true },
      { name: t(language, "duration"), value: formatDuration(track.length), inline: true }
    )
    .setFooter({ text: tierBadge(tier, language) });
}

function playlistAddedEmbed(playlistName, count, tier, language = "en") {
  return new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle(t(language, "playlist_added_title"))
    .setDescription(t(language, "playlist_description", { playlistName, count }))
    .setFooter({ text: tierBadge(tier, language) });
}

function queueEmbed(player, tier, page = 1, language = "en") {
  const perPage = 10;
  const queue = player.queue.tracks ?? [...player.queue];
  const totalPages = Math.max(1, Math.ceil(queue.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = queue.slice((safePage - 1) * perPage, safePage * perPage);

  const current = player.queue.current;

  const embed = new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle(t(language, "queue_title"))
    .setFooter({ text: `${t(language, "page_x_of_y", { page: safePage, totalPages })} · ${queue.length} ${t(language, "tracks")} · ${tierBadge(tier, language)}` });

  if (current) {
    embed.addFields({
      name: t(language, "now"),
      value: `[${current.title}](${current.uri}) — ${formatDuration(current.length)}`,
    });
  }

  if (slice.length === 0) {
    embed.setDescription(t(language, "empty_queue"));
  } else {
    const lines = slice.map(
      (trk, i) =>
        `**${(safePage - 1) * perPage + i + 1}.** [${trk.title}](${trk.uri}) — ${formatDuration(trk.length)}`
    );
    embed.setDescription(lines.join("\n"));
  }

  return embed;
}

function errorEmbed(message, language = "en") {
  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle(t(language, "error_title"))
    .setDescription(message);
}

function warningEmbed(message, tier, language = "en") {
  return new EmbedBuilder()
    .setColor(COLOR_WARNING)
    .setTitle(t(language, "warning_title"))
    .setDescription(message)
    .setFooter({ text: tier ? tierBadge(tier, language) : "" });
}

function proOnlyEmbed(featureName, upgradeUrl, language = "en") {
  const embed = new EmbedBuilder()
    .setColor(COLOR_PRO)
    .setTitle(t(language, "pro_only_title"))
    .setDescription(t(language, "pro_only_description", { featureName }));

  if (upgradeUrl) {
    embed.addFields({ name: t(language, "upgrade"), value: t(language, "upgrade_value", { url: upgradeUrl }) });
  }

  return embed;
}

module.exports = {
  nowPlayingEmbed,
  addedToQueueEmbed,
  playlistAddedEmbed,
  queueEmbed,
  errorEmbed,
  warningEmbed,
  proOnlyEmbed,
  formatDuration,
  tierBadge,
};
