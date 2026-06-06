"use strict";

const { EmbedBuilder } = require("discord.js");
const { t } = require("./i18n");

const BRAND_NAME = "TON618 Music";
const COLORS = Object.freeze({
  PLAYING: 0x7c3aed,
  PAUSED: 0x5865f2,
  SUCCESS: 0x57f287,
  WARNING: 0xf59e0b,
  ERROR: 0xed4245,
  NEUTRAL: 0x2b2d31,
});

const SOURCE_LABELS = Object.freeze({
  youtube: "YouTube",
  youtubemusic: "YouTube Music",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  applemusic: "Apple Music",
  deezer: "Deezer",
  bandcamp: "Bandcamp",
  twitch: "Twitch",
  vimeo: "Vimeo",
});

function truncate(value, maxLength = 100) {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatDuration(ms) {
  const duration = Number(ms);
  if (!Number.isFinite(duration) || duration <= 0) return "LIVE";
  return formatTimestamp(duration);
}

function formatTimestamp(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSource(sourceName, language = "en") {
  const rawSource = String(sourceName || "").trim();
  const source = rawSource.toLowerCase();
  if (!source) return t(language, "unknown");
  if (source === "http") return t(language, "source_direct");
  if (source === "local") return t(language, "source_local");
  return SOURCE_LABELS[source] || rawSource.charAt(0).toUpperCase() + rawSource.slice(1);
}

function formatLoop(loop, language = "en") {
  const labels = {
    track: t(language, "loop_track_short"),
    queue: t(language, "loop_queue_short"),
    none: t(language, "label_disabled"),
  };
  return labels[loop] || labels.none;
}

function createProgressBar(positionMs, durationMs, length = 14) {
  const position = Math.max(0, Number(positionMs) || 0);
  const duration = Number(durationMs) || 0;

  if (duration <= 0) {
    return `\`${formatTimestamp(position)}\` • LIVE`;
  }

  const safeLength = Math.max(5, Math.min(20, Number(length) || 14));
  const ratio = Math.max(0, Math.min(1, position / duration));
  const markerIndex = Math.min(safeLength - 1, Math.floor(ratio * safeLength));
  const bar = Array.from({ length: safeLength }, (_, index) => (index === markerIndex ? "●" : "━")).join("");

  return `\`${formatDuration(position)}\` ${bar} \`${formatDuration(duration)}\``;
}

function tierBadge(tier, language = "en") {
  return tier === "pro" ? t(language, "tier_badge_pro") : t(language, "tier_badge_free");
}

function footerText(parts = []) {
  const values = Array.isArray(parts) ? parts : [parts];
  return [BRAND_NAME, ...values.filter(Boolean)].join(" • ");
}

function isHttpUrl(value) {
  if (!value || String(value).length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function trackMarkdown(track, maxLength = 90) {
  const title = truncate(track?.title || "Unknown track", maxLength);
  const escapedTitle = title.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return isHttpUrl(track?.uri) && track.uri.length <= 200
    ? `[${escapedTitle}](${track.uri})`
    : escapedTitle;
}

function requesterName(requester, language) {
  return requester?.globalName || requester?.displayName || requester?.tag || requester?.username || t(language, "unknown");
}

function getQueueTracks(player) {
  if (!player?.queue) return [];
  if (Array.isArray(player.queue.tracks)) return player.queue.tracks;
  return Array.from(player.queue);
}

function getApproximateQueueDuration(player) {
  const queue = getQueueTracks(player);
  const current = player?.queue?.current;
  const currentLength = Number(current?.length) || 0;
  const currentPosition = Math.max(0, Number(player?.position) || 0);
  const currentRemaining = current?.isStream ? 0 : Math.max(0, currentLength - currentPosition);

  return queue.reduce((total, track) => {
    if (track?.isStream) return total;
    const length = Number(track?.length) || 0;
    return total + Math.max(0, length);
  }, currentRemaining);
}

function createNowPlayingEmbed(track, player, tier, language = "en") {
  const paused = Boolean(player?.paused);
  const queueSize = Number(player?.queue?.size) || 0;
  const requester = requesterName(track?.requester, language);
  const embed = new EmbedBuilder()
    .setColor(paused ? COLORS.PAUSED : COLORS.PLAYING)
    .setAuthor({ name: paused ? t(language, "status_paused") : t(language, "status_playing") })
    .setTitle(truncate(track?.title || t(language, "unknown"), 256))
    .setDescription(createProgressBar(player?.position, track?.length))
    .addFields(
      {
        name: t(language, "author"),
        value: truncate(track?.author || t(language, "unknown"), 100),
        inline: true,
      },
      {
        name: t(language, "source"),
        value: formatSource(track?.sourceName, language),
        inline: true,
      },
      {
        name: t(language, "duration"),
        value: formatDuration(track?.length),
        inline: true,
      },
      {
        name: t(language, "volume"),
        value: `${Number.isFinite(Number(player?.volume)) ? Number(player.volume) : 100}%`,
        inline: true,
      },
      {
        name: t(language, "loop"),
        value: formatLoop(player?.loop, language),
        inline: true,
      },
      {
        name: t(language, "remaining_queue"),
        value: t(language, "track_count", { count: queueSize }),
        inline: true,
      }
    )
    .setFooter({
      text: footerText([
        `${t(language, "requested_by")} ${truncate(requester, 40)}`,
        tierBadge(tier, language),
      ]),
    });

  if (isHttpUrl(track?.uri)) embed.setURL(track.uri);
  if (isHttpUrl(track?.thumbnail)) embed.setThumbnail(track.thumbnail);
  return embed;
}

function addedToQueueEmbed(track, position, tier, language = "en") {
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setAuthor({ name: t(language, "added_to_queue_title") })
    .setTitle(truncate(track?.title || t(language, "unknown"), 256))
    .addFields(
      {
        name: t(language, "author"),
        value: truncate(track?.author || t(language, "unknown"), 100),
        inline: true,
      },
      {
        name: t(language, "duration"),
        value: formatDuration(track?.length),
        inline: true,
      },
      {
        name: t(language, "queue_position"),
        value: `#${Math.max(1, Number(position) || 1)}`,
        inline: true,
      }
    )
    .setFooter({ text: footerText([tierBadge(tier, language)]) });

  if (isHttpUrl(track?.uri)) embed.setURL(track.uri);
  if (isHttpUrl(track?.thumbnail)) embed.setThumbnail(track.thumbnail);
  return embed;
}

function playlistAddedEmbed(playlistName, count, tier, language = "en") {
  return createMusicSuccessEmbed(
    t(language, "playlist_added_title"),
    t(language, "playlist_description", {
      playlistName: truncate(playlistName, 120),
      count,
    }),
    { tier, language }
  );
}

function createQueueEmbed(player, tier, page = 1, language = "en") {
  const perPage = 10;
  const queue = getQueueTracks(player);
  const totalPages = Math.max(1, Math.ceil(queue.length / perPage));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const pageTracks = queue.slice((safePage - 1) * perPage, safePage * perPage);
  const current = player?.queue?.current;
  const totalTracks = queue.length + (current ? 1 : 0);
  const approximateDuration = getApproximateQueueDuration(player);

  const embed = new EmbedBuilder()
    .setColor(COLORS.NEUTRAL)
    .setTitle(t(language, "queue_title"))
    .setFooter({
      text: footerText([
        t(language, "page_x_of_y", { page: safePage, totalPages }),
        t(language, "track_count", { count: totalTracks }),
        tierBadge(tier, language),
      ]),
    });

  if (current) {
    const state = player?.paused ? t(language, "status_paused") : t(language, "status_playing");
    embed.addFields({
      name: t(language, "now"),
      value: [
        `**${trackMarkdown(current, 90)}**`,
        `${truncate(current.author || t(language, "unknown"), 60)} • ${formatDuration(current.length)} • ${state}`,
      ].join("\n"),
    });
    if (isHttpUrl(current.thumbnail)) embed.setThumbnail(current.thumbnail);
  }

  if (pageTracks.length === 0) {
    embed.setDescription(t(language, "empty_queue"));
  } else {
    const lines = pageTracks.map((track, index) => {
      const number = (safePage - 1) * perPage + index + 1;
      return `**${number}.** ${trackMarkdown(track, 75)} • \`${formatDuration(track.length)}\``;
    });
    embed.setDescription(`**${t(language, "up_next")}**\n${lines.join("\n")}`);
  }

  if (approximateDuration > 0) {
    embed.addFields({
      name: t(language, "approximate_duration"),
      value: formatDuration(approximateDuration),
      inline: true,
    });
  }

  return embed;
}

function createMusicErrorEmbed(message, language = "en", options = {}) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(options.title || t(language, "error_title"))
    .setDescription(truncate(message, 4096))
    .setFooter({ text: footerText(options.footerParts) });
}

function createMusicSuccessEmbed(title, description, options = {}) {
  const language = options.language || "en";
  const footerParts = [];
  if (options.tier) footerParts.push(tierBadge(options.tier, language));
  if (Array.isArray(options.footerParts)) footerParts.push(...options.footerParts);

  return new EmbedBuilder()
    .setColor(options.color ?? COLORS.SUCCESS)
    .setTitle(truncate(title, 256))
    .setDescription(truncate(description, 4096))
    .setFooter({ text: footerText(footerParts) });
}

function createMusicWarningEmbed(message, tier, language = "en", options = {}) {
  const footerParts = [];
  if (tier) footerParts.push(tierBadge(tier, language));
  if (Array.isArray(options.footerParts)) footerParts.push(...options.footerParts);

  return new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle(options.title || t(language, "warning_title"))
    .setDescription(truncate(message, 4096))
    .setFooter({ text: footerText(footerParts) });
}

function proOnlyEmbed(featureName, upgradeUrl, language = "en") {
  const embed = createMusicWarningEmbed(
    t(language, "pro_only_description", { featureName }),
    null,
    language,
    { title: t(language, "pro_only_title") }
  );

  if (upgradeUrl) {
    embed.addFields({
      name: t(language, "upgrade"),
      value: t(language, "upgrade_value", { url: upgradeUrl }),
    });
  }

  return embed;
}

module.exports = {
  BRAND_NAME,
  COLORS,
  createNowPlayingEmbed,
  createQueueEmbed,
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
  createProgressBar,
  formatSource,
  formatDuration,
  formatLoop,
  truncate,
  addedToQueueEmbed,
  playlistAddedEmbed,
  proOnlyEmbed,
  tierBadge,
  nowPlayingEmbed: createNowPlayingEmbed,
  queueEmbed: createQueueEmbed,
  errorEmbed: createMusicErrorEmbed,
  warningEmbed: createMusicWarningEmbed,
};
