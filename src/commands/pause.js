"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");

const data = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pausa o reanuda la reproducción");

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "pause_voice_required"), language)] });
    }

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "pause_no_player"), language)] });
    }

    if (player.paused) {
      await player.pause(false);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(t(language, "pause_resumed"))
            .setDescription(t(language, "pause_resumed_desc")),
        ],
      });
    } else {
      await player.pause(true);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle(t(language, "pause_paused"))
            .setDescription(t(language, "pause_paused_desc")),
        ],
      });
    }
  },
};
