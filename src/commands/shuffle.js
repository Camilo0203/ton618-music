"use strict";

/**
 * /shuffle — Mezcla la cola (SOLO PRO)
 */

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  proOnlyEmbed,
} = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");
const { createLogger } = require("../utils/logger");
const { MusicControlService } = require("../services/MusicControlService");

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
      return safeRespond(interaction, {
        embeds: [proOnlyEmbed(t(language, "shuffle_pro_only"), UPGRADE_URL, language)],
      });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "error_lavalink"), language)],
      });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player || player.queue.size === 0) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "shuffle_empty"), language)],
      });
    }

    const controlService = new MusicControlService(musicManager);
    controlService.shuffleQueue(player);

    return safeRespond(interaction, {
      embeds: [
        createMusicSuccessEmbed(
          t(language, "shuffle_done"),
          t(language, "shuffle_done_desc", { count: player.queue.size }),
          { tier, language }
        ),
      ],
    });
  },
};
