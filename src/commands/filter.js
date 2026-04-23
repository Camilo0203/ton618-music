"use strict";

/**
 * /filter — Aplica filtros de audio (SOLO PRO)
 * Disponibles: bassboost, nightcore, vaporwave, reset
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { errorEmbed, proOnlyEmbed } = require("../utils/musicEmbeds");

const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";

const FILTER_DESCRIPTIONS = {
  bassboost: "🔊 Bass Boost — Graves potenciados",
  nightcore: "⚡ Nightcore — Velocidad y pitch aumentados",
  vaporwave: "🌊 Vaporwave — Ambiente lento y etéreo",
  reset: "🔄 Reset — Sin filtros",
};

const data = new SlashCommandBuilder()
  .setName("filter")
  .setDescription("Aplica un filtro de audio [Solo PRO]")
  .addStringOption((opt) =>
    opt
      .setName("tipo")
      .setDescription("Tipo de filtro a aplicar")
      .setRequired(true)
      .addChoices(
        { name: "🔊 Bass Boost", value: "bassboost" },
        { name: "⚡ Nightcore", value: "nightcore" },
        { name: "🌊 Vaporwave", value: "vaporwave" },
        { name: "🔄 Reset (sin filtros)", value: "reset" }
      )
  );

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const tier = await resolveGuildTier(interaction.guildId);

    if (tier !== "pro") {
      return interaction.editReply({
        embeds: [proOnlyEmbed("Filtros de audio (Bass Boost, Nightcore, Vaporwave)", UPGRADE_URL)],
      });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed("Debes estar en un canal de voz.")] });
    }

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player || !player.playing) {
      return interaction.editReply({ embeds: [errorEmbed("No hay nada reproduciéndose ahora mismo.")] });
    }

    const filterName = interaction.options.getString("tipo");
    const result = await musicManager.applyFilter(player, filterName);

    if (!result.ok) {
      return interaction.editReply({
        embeds: [errorEmbed(`No se pudo aplicar el filtro: \`${result.reason}\``)],
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🎛 Filtro aplicado")
          .setDescription(FILTER_DESCRIPTIONS[filterName] || filterName)
          .setFooter({ text: "✨ PRO" }),
      ],
    });
  },
};
