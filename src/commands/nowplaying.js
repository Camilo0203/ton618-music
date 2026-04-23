"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { nowPlayingEmbed, errorEmbed, formatDuration } = require("../utils/musicEmbeds");

const data = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Muestra la pista que se está reproduciendo ahora mismo");

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player || (!player.playing && !player.paused)) {
      return interaction.editReply({ embeds: [errorEmbed("No hay nada reproduciéndose ahora mismo.")] });
    }

    const current = player.queue.current;
    if (!current) {
      return interaction.editReply({ embeds: [errorEmbed("No hay pista activa.")] });
    }

    const tier = await resolveGuildTier(interaction.guildId);

    // Barra de progreso
    const position = player.position || 0;
    const duration = current.length || 0;
    const BAR_LENGTH = 20;
    const filled = duration > 0 ? Math.round((position / duration) * BAR_LENGTH) : 0;
    const bar = "█".repeat(filled) + "░".repeat(BAR_LENGTH - filled);
    const progressText = `\`${formatDuration(position)}\` ${bar} \`${formatDuration(duration)}\``;

    const embed = nowPlayingEmbed(current, player, tier);
    embed.addFields({ name: "Progreso", value: progressText });

    return interaction.editReply({ embeds: [embed] });
  },
};
