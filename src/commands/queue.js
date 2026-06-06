"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { createQueueEmbed, createMusicErrorEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");

const log = createLogger("QueueCommand");

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
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId: interaction.guildId });
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "error_lavalink"), language)],
      });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "queue_no_player"), language)],
      });
    }

    const tier = await resolveGuildTier(interaction.guildId);
    const page = interaction.options.getInteger("pagina") ?? 1;

    return safeRespond(interaction, {
      embeds: [createQueueEmbed(player, tier, page, language)],
    });
  },
};
