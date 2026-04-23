"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { errorEmbed, warningEmbed } = require("../utils/musicEmbeds");
const { EmbedBuilder } = require("discord.js");
const { TIER_LIMITS } = require("../config/lavalinkConfig");

const data = new SlashCommandBuilder()
  .setName("skip")
  .setDescription("Salta la canción actual")
  .addIntegerOption((opt) =>
    opt
      .setName("cantidad")
      .setDescription("Cuántas pistas saltar (PRO: hasta 10)")
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false)
  );

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

    if (!player || (!player.playing && !player.paused)) {
      return interaction.editReply({ embeds: [errorEmbed("No hay nada reproduciéndose ahora mismo.")] });
    }

    const tier = await resolveGuildTier(interaction.guildId);
    let amount = interaction.options.getInteger("cantidad") ?? 1;

    // FREE solo puede saltar de 1 en 1
    if (amount > 1 && tier === "free") {
      return interaction.editReply({
        embeds: [
          warningEmbed(
            `Saltar múltiples pistas a la vez es una función **PRO**. [Actualiza aquí](${process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing"}).`,
            tier
          ),
        ],
      });
    }

    const skipped = player.queue.current;
    for (let i = 0; i < amount && player.queue.size > 0; i++) {
      await player.skip();
    }

    if (amount === 1 && skipped) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("⏭ Saltado")
            .setDescription(`Se saltó: **${skipped.title}**`),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("⏭ Saltadas")
          .setDescription(`Se saltaron **${amount}** pistas.`),
      ],
    });
  },
};
