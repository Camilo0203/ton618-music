"use strict";

/**
 * /shuffle — Mezcla la cola (SOLO PRO)
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { errorEmbed, proOnlyEmbed } = require("../utils/musicEmbeds");

const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";

const data = new SlashCommandBuilder()
  .setName("shuffle")
  .setDescription("Mezcla aleatoriamente la cola [Solo PRO]");

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const tier = await resolveGuildTier(interaction.guildId);

    if (tier !== "pro") {
      return interaction.editReply({
        embeds: [proOnlyEmbed("Mezclar cola (Shuffle)", UPGRADE_URL)],
      });
    }

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player || player.queue.size === 0) {
      return interaction.editReply({ embeds: [errorEmbed("La cola está vacía.")] });
    }

    player.queue.shuffle();

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🔀 Cola mezclada")
          .setDescription(`Se mezclaron **${player.queue.size}** pistas aleatoriamente.`)
          .setFooter({ text: "✨ PRO" }),
      ],
    });
  },
};
