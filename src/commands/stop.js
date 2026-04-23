"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/musicEmbeds");

const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Detiene la reproducción, limpia la cola y desconecta el bot");

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
      return interaction.editReply({ embeds: [errorEmbed("No hay nada reproduciéndose ahora mismo.")] });
    }

    await musicManager.destroyPlayer(interaction.guildId);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("⏹ Detenido")
          .setDescription("La reproducción se detuvo y el bot se desconectó."),
      ],
    });
  },
};
