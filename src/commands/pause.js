"use strict";

const { SlashCommandBuilder } = require("discord.js");
const {
  COLORS,
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
} = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");
const { createLogger } = require("../utils/logger");
const { MusicControlService } = require("../services/MusicControlService");

const log = createLogger("PauseCommand");

const data = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pausa o reanuda la reproducción");

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "pause_voice_required"), language)],
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

    if (!player) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "pause_no_player"), language)],
      });
    }

    const controlService = new MusicControlService(musicManager);
    if (player.paused) {
      controlService.togglePause(player);
      return safeRespond(interaction, {
        embeds: [
          createMusicSuccessEmbed(
            t(language, "pause_resumed"),
            t(language, "pause_resumed_desc"),
            { language }
          ),
        ],
      });
    } else {
      controlService.togglePause(player);
      return safeRespond(interaction, {
        embeds: [
          createMusicSuccessEmbed(
            t(language, "pause_paused"),
            t(language, "pause_paused_desc"),
            { color: COLORS.PAUSED, language }
          ),
        ],
      });
    }
  },
};
