"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { createNowPlayingEmbed, createMusicErrorEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");

const log = createLogger("NowPlayingCommand");

const data = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Muestra la pista que se está reproduciendo ahora mismo");

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

    if (!player || (!player.playing && !player.paused)) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "nowplaying_nothing"), language)],
      });
    }

    const current = player.queue.current;
    if (!current) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "nowplaying_no_track"), language)],
      });
    }

    const tier = await resolveGuildTier(interaction.guildId);

    return safeRespond(interaction, {
      embeds: [createNowPlayingEmbed(current, player, tier, language)],
    });
  },
};
