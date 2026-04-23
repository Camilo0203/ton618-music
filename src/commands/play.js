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

    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [errorEmbed("Debes estar en un canal de voz para usar este comando.")],
      });
    }

    const botMember = interaction.guild.members.me;
    const perms = voiceChannel.permissionsFor(botMember);
    if (!perms.has("Connect") || !perms.has("Speak")) {
      return interaction.editReply({
        embeds: [errorEmbed("No tengo permisos para conectarme o hablar en tu canal de voz.")],
      });
    }

    const query = interaction.options.getString("query");
    const guildId = interaction.guildId;

    const tier = await resolveGuildTier(guildId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Bloquear Spotify en FREE
    const isSpotify =
      query.includes("open.spotify.com") || query.includes("spotify:");
    if (isSpotify && !limits.spotifyEnabled) {
      return interaction.editReply({
        embeds: [proOnlyEmbed("Reproducción de Spotify", UPGRADE_URL)],
      });
    }

    /** @type {import('../music/MusicManager').MusicManager} */
    const musicManager = interaction.client.musicManager;

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
        embeds: [errorEmbed("No pude conectarme al canal de voz. ¿El servidor Lavalink está activo?")],
      });
    }

    let result;
    try {
      result = await musicManager.search(query, tier);
    } catch (err) {
      return interaction.editReply({
        embeds: [errorEmbed("Error buscando la canción. Inténtalo de nuevo.")],
      });
    }

    if (!result || !result.tracks || result.tracks.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed(`No encontré resultados para: **${query}**`)],
      });
    }

    // Playlists solo en PRO
    if (result.type === "PLAYLIST" && !limits.playlistEnabled) {
      return interaction.editReply({
        embeds: [proOnlyEmbed("Reproducción de playlists completas", UPGRADE_URL)],
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
        await player.play();
      }

      return interaction.editReply({
        embeds: [playlistAddedEmbed(result.playlistName || "Playlist", added, tier)],
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
            ? `La cola FREE está llena (máx. **${max}** pistas). [Actualiza a PRO](${UPGRADE_URL}) para colas de hasta **200 pistas**.`
            : `La cola está llena (máx. **${max}** pistas).`;
        return interaction.editReply({ embeds: [warningEmbed(msg, tier)] });
      }

      if (enqueueResult.reason?.startsWith("too_long")) {
        const maxMin = Math.floor(limits.maxDurationSeconds / 60);
        const msg =
          tier === "free"
            ? `Las pistas FREE no pueden superar **${maxMin} minutos**. [Actualiza a PRO](${UPGRADE_URL}) para pistas de hasta 6 horas.`
            : `La pista supera la duración máxima de **${maxMin} minutos**.`;
        return interaction.editReply({ embeds: [warningEmbed(msg, tier)] });
      }

      return interaction.editReply({
        embeds: [errorEmbed("No se pudo añadir la pista a la cola.")],
      });
    }

    if (!player.playing && !player.paused) {
      await player.play();
      return interaction.editReply({
        embeds: [nowPlayingEmbed(track, player, tier)],
      });
    }

    const position = player.queue.size;
    return interaction.editReply({
      embeds: [addedToQueueEmbed(track, position, tier)],
    });
  },
};
