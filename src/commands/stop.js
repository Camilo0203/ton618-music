"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { createMusicErrorEmbed, createMusicSuccessEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");

const log = createLogger("StopCommand");

const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Detiene la reproducción, limpia la cola y desconecta el bot");

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const guildId = interaction.guildId;
    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "stop_voice_required"), language)],
      });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId });
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "error_lavalink"), language)],
      });
    }

    const player = musicManager.kazagumo.players.get(guildId);
    if (!player) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "stop_nothing_playing"), language)],
      });
    }

    try {
      await musicManager.destroyPlayer(guildId);
      log.info("Playback stopped by user", { guildId, userId: interaction.user.id });
    } catch (err) {
      log.error("Failed to destroy player", { guildId, error: err.message });
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "error_generic"), language)],
      });
    }

    return safeRespond(interaction, {
      embeds: [
        createMusicSuccessEmbed(
          t(language, "stop_stopped"),
          t(language, "stop_stopped_desc"),
          { language }
        ),
      ],
    });
  },
};
