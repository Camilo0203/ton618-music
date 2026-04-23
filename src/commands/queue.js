"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { queueEmbed, errorEmbed } = require("../utils/musicEmbeds");

const data = new SlashCommandBuilder()
  .setName("queue")
  .setDescription("Muestra la cola de reproducción")
  .addIntegerOption((opt) =>
    opt
      .setName("pagina")
      .setDescription("Número de página")
      .setMinValue(1)
      .setRequired(false)
  );

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.editReply({ embeds: [errorEmbed("No hay ningún player activo en este servidor.")] });
    }

    const tier = await resolveGuildTier(interaction.guildId);
    const page = interaction.options.getInteger("pagina") ?? 1;

    return interaction.editReply({ embeds: [queueEmbed(player, tier, page)] });
  },
};
