"use strict";

/**
 * /filter — Aplica filtros de audio (SOLO PRO)
 * Disponibles: bassboost, nightcore, vaporwave, reset
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { errorEmbed, proOnlyEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred } = require("../utils/interactionResponses");

const log = createLogger("FilterCommand");
const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";

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
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const FILTER_DESCRIPTIONS = {
      bassboost: t(language, "filter_bassboost"),
      nightcore: t(language, "filter_nightcore"),
      vaporwave: t(language, "filter_vaporwave"),
      reset: t(language, "filter_reset"),
    };

    const tier = await resolveGuildTier(interaction.guildId);

    if (tier !== "pro") {
      return interaction.editReply({
        embeds: [proOnlyEmbed(t(language, "filter_pro_only"), UPGRADE_URL, language)],
      });
    }

    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "filter_voice_required"), language)] });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return interaction.editReply({ embeds: [errorEmbed(t(language, "error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player || !player.playing) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "filter_no_player"), language)] });
    }

    const filterName = interaction.options.getString("tipo");
    const result = await musicManager.applyFilter(player, filterName);

    if (!result.ok) {
      return interaction.editReply({
        embeds: [errorEmbed(`${t(language, "filter_applied")}: \`${result.reason}\``, language)],
      });
    }

    if (filterName === "reset") {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(t(language, "filter_removed"))
            .setDescription(t(language, "filter_removed_desc"))
            .setFooter({ text: t(language, "tier_badge_pro") }),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(t(language, "filter_applied"))
          .setDescription(FILTER_DESCRIPTIONS[filterName] || filterName)
          .setFooter({ text: t(language, "tier_badge_pro") }),
      ],
    });
  },
};
