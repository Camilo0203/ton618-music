"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/musicEmbeds");

const data = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pausa o reanuda la reproducción");

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed("Debes estar en un canal de voz.")] });
    }

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.editReply({ embeds: [errorEmbed("No hay ningún player activo.")] });
    }

    if (player.paused) {
      await player.pause(false);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("▶ Reanudado")
            .setDescription("La reproducción ha sido reanudada."),
        ],
      });
    } else {
      await player.pause(true);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle("⏸ Pausado")
            .setDescription("La reproducción ha sido pausada. Usa `/pause` de nuevo para reanudar."),
        ],
      });
    }
  },
};
