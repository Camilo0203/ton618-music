"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred } = require("../utils/interactionResponses");

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
      return interaction.editReply({ embeds: [errorEmbed(t(language, "stop_voice_required"), language)] });
    }

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId });
      return interaction.editReply({ embeds: [errorEmbed(t(language, "error_lavalink"), language)] });
    }

    const player = musicManager.kazagumo.players.get(guildId);
    if (!player) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "stop_nothing_playing"), language)] });
    }

    try {
      await musicManager.destroyPlayer(guildId);
      log.info("Playback stopped by user", { guildId, userId: interaction.user.id });
    } catch (err) {
      log.error("Failed to destroy player", { guildId, error: err.message });
      return interaction.editReply({ embeds: [errorEmbed(t(language, "error_generic"), language)] });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle(t(language, "stop_stopped"))
          .setDescription(t(language, "stop_stopped_desc")),
      ],
    });
  },
};
