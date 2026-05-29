"use strict";

/**
 * /shuffle — Mezcla la cola (SOLO PRO)
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { errorEmbed, proOnlyEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { ensureDeferred } = require("../utils/interactionResponses");
const { createLogger } = require("../utils/logger");

const log = createLogger("ShuffleCommand");
const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";

const data = new SlashCommandBuilder()
  .setName("shuffle")
  .setDescription("Mezcla aleatoriamente la cola [Solo PRO]");

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const tier = await resolveGuildTier(interaction.guildId);

    if (tier !== "pro") {
      return interaction.editReply({
        embeds: [proOnlyEmbed(t(language, "shuffle_pro_only"), UPGRADE_URL, language)],
      });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return interaction.editReply({ embeds: [errorEmbed(t(language, "error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player || player.queue.size === 0) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "shuffle_empty"), language)] });
    }

    player.queue.shuffle();

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(t(language, "shuffle_done"))
          .setDescription(t(language, "shuffle_done_desc", { count: player.queue.size }))
          .setFooter({ text: t(language, "tier_badge_pro") }),
      ],
    });
  },
};
