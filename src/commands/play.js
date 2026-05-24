"use strict";

/**
 * /play — Reproduce una canción o playlist (Refactor 2025)
 *
 * Mejoras:
 *  - Logging estructurado de cada paso
 *  - Mensajes de error específicos por tipo de fallo
 *  - Manejo robusto de voice channel perms
 *  - Fallback a soundcloud si youtube devuelve 403
 */

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { TIER_LIMITS } = require("../config/lavalinkConfig");
const {
  nowPlayingEmbed,
  addedToQueueEmbed,
  playlistAddedEmbed,
  errorEmbed,
  warningEmbed,
  proOnlyEmbed,
} = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");

const log = createLogger("PlayCommand");

const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";

const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Reproduce una canción o playlist en tu canal de voz")
  .addStringOption((opt) =>
    opt
      .setName("query")
      .setDescription("Nombre de la canción, URL de YouTube o Spotify (PRO)")
      .setRequired(true)
  );

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const member = interaction.guild?.members?.cache?.get(interaction.user.id);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_voice_required"), language)],
      });
    }

    const botMember = interaction.guild.members.me;
    const perms = voiceChannel.permissionsFor(botMember);
    if (!perms?.has("Connect") || !perms?.has("Speak")) {
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_bot_permissions"), language)],
      });
    }

    const query = interaction.options.getString("query");
    const guildId = interaction.guildId;

    let tier;
    try {
      tier = await Promise.race([
        resolveGuildTier(guildId),
        new Promise((_, reject) => setTimeout(() => reject(new Error("tier_timeout")), 3000)),
      ]);
    } catch (err) {
      log.warn("Tier resolution timeout, defaulting to free", { guildId, error: err.message });
      tier = "free";
    }
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Bloquear playlists de Spotify en FREE
    const isSpotifyPlaylist =
      (query.includes("open.spotify.com/playlist") || query.includes("open.spotify.com/album")) &&
      !limits.spotifyEnabled;
    if (isSpotifyPlaylist) {
      return interaction.editReply({
        embeds: [proOnlyEmbed(t(language, "spotify_pro_only"), UPGRADE_URL, language)],
      });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available — client not ready", { guildId });
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_lavalink"), language)],
      });
    }

    let player;
    try {
      player = await musicManager.getOrCreatePlayer({
        guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
        tier,
      });
    } catch (err) {
      log.error("Failed to create player", { guildId, error: err.message });
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_lavalink"), language)],
      });
    }

    let result;
    try {
      result = await musicManager.search(query, tier);
    } catch (err) {
      const msg = err?.message?.toLowerCase() || "";
      log.error("Search failed", { guildId, query: query.slice(0, 60), error: err.message });

      let userMsg = t(language, "error_search");
      if (msg.includes("403") || msg.includes("bot") || msg.includes("sign in")) {
        userMsg = "🚫 YouTube is blocking this request. Try a different song or wait a moment.";
      } else if (msg.includes("timeout") || msg.includes("network")) {
        userMsg = "⏳ The music server is taking too long to respond. Please try again.";
      } else if (msg.includes("no results")) {
        userMsg = t(language, "error_no_results", { query });
      }

      return interaction.editReply({
        embeds: [errorEmbed(userMsg, language)],
      });
    }

    if (!result?.tracks?.length) {
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_no_results", { query }), language)],
      });
    }

    // Playlists solo en PRO
    if (result.type === "PLAYLIST" && !limits.playlistEnabled) {
      return interaction.editReply({
        embeds: [proOnlyEmbed(t(language, "playlist_pro_only"), UPGRADE_URL, language)],
      });
    }

    if (result.type === "PLAYLIST") {
      let added = 0;
      for (const track of result.tracks) {
        track.requester = interaction.user;
        const enqueueResult = musicManager.enqueue(player, track);
        if (!enqueueResult.ok) break;
        added++;
      }

      log.info("Playlist enqueued", { guildId, added, total: result.tracks.length });

      if (!player.playing && !player.paused) {
        try {
          await player.play();
        } catch (err) {
          log.error("Failed to start playlist playback", { guildId, error: err.message });
          return interaction.editReply({
            embeds: [errorEmbed(t(language, "error_play"), language)],
          });
        }
      }

      return interaction.editReply({
        embeds: [playlistAddedEmbed(result.playlistName || "Playlist", added, tier, language)],
      });
    }

    // Canción individual
    const track = result.tracks[0];
    track.requester = interaction.user;

    const enqueueResult = musicManager.enqueue(player, track);

    if (!enqueueResult.ok) {
      if (enqueueResult.reason?.startsWith("queue_full")) {
        const max = limits.maxQueue;
        const msg =
          tier === "free"
            ? t(language, "error_queue_full_free", { max, url: UPGRADE_URL })
            : t(language, "error_queue_full_pro", { max });
        return interaction.editReply({ embeds: [warningEmbed(msg, tier, language)] });
      }

      if (enqueueResult.reason?.startsWith("too_long")) {
        const maxMin = Math.floor(limits.maxDurationSeconds / 60);
        const msg =
          tier === "free"
            ? t(language, "error_too_long_free", { maxMin, url: UPGRADE_URL })
            : t(language, "error_too_long_pro", { maxMin });
        return interaction.editReply({ embeds: [warningEmbed(msg, tier, language)] });
      }

      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_add_track"), language)],
      });
    }

    if (!player.playing && !player.paused) {
      try {
        await player.play();
      } catch (err) {
        log.error("Failed to start track playback", { guildId, track: track.title, error: err.message });
        return interaction.editReply({
          embeds: [errorEmbed(t(language, "error_play"), language)],
        });
      }
      log.info("Now playing", { guildId, track: track.title });
      return interaction.editReply({
        embeds: [nowPlayingEmbed(track, player, tier, language)],
      });
    }

    const position = player.queue.size;
    log.info("Track added to queue", { guildId, track: track.title, position });
    return interaction.editReply({
      embeds: [addedToQueueEmbed(track, position, tier, language)],
    });
  },
};
