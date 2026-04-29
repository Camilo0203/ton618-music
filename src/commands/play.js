"use strict";

/**
 * /play — Reproduce una canción o playlist
 *
 * Diferencias PRO vs FREE:
 *   FREE: máx 5 min por pista, cola 10, solo YouTube
 *   PRO:  sin límite práctico, cola 200, YouTube + playlists
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
    if (!perms.has("Connect") || !perms.has("Speak") || !perms.has("Use VAD")) {
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_bot_permissions"), language)],
      });
    }

    const query = interaction.options.getString("query");
    const guildId = interaction.guildId;

    let tier;
    try {
      tier = await resolveGuildTier(guildId);
    } catch (err) {
      console.error("[play] Error resolving tier:", err?.message || err);
      tier = "free";
    }
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Bloquear Spotify en FREE
    const isSpotify =
      query.includes("open.spotify.com") || query.includes("spotify:");
    if (isSpotify && !limits.spotifyEnabled) {
      return interaction.editReply({
        embeds: [proOnlyEmbed(t(language, "spotify_pro_only"), UPGRADE_URL, language)],
      });
    }

    /** @type {import('../music/MusicManager').MusicManager} */
    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      console.error("[play] musicManager is undefined — client not ready?");
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
      console.error("[play] Error creando player:", err?.message || err);
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_lavalink"), language)],
      });
    }

    let result;
    try {
      result = await musicManager.search(query, tier);
    } catch (err) {
      console.error("[play] Error en search:", err?.message || err);
      return interaction.editReply({
        embeds: [errorEmbed(t(language, "error_search"), language)],
      });
    }

    if (!result || !result.tracks || result.tracks.length === 0) {
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

      if (!player.playing && !player.paused) {
        try {
          await player.play();
        } catch (err) {
          console.error("[play] Error en play playlist:", err?.message || err);
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
        console.error("[play] Error en play track:", err?.message || err);
        return interaction.editReply({
          embeds: [errorEmbed(t(language, "error_play"), language)],
        });
      }
      return interaction.editReply({
        embeds: [nowPlayingEmbed(track, player, tier, language)],
      });
    }

    const position = player.queue.size;
    return interaction.editReply({
      embeds: [addedToQueueEmbed(track, position, tier, language)],
    });
  },
};
