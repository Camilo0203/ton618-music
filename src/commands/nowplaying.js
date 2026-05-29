"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { nowPlayingEmbed, errorEmbed, formatDuration } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred } = require("../utils/interactionResponses");

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
      return interaction.editReply({ embeds: [errorEmbed(t(language, "error_lavalink"), language)] });
    }
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player || (!player.playing && !player.paused)) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "nowplaying_nothing"), language)] });
    }

    const current = player.queue.current;
    if (!current) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "nowplaying_no_track"), language)] });
    }

    const tier = await resolveGuildTier(interaction.guildId);

    // Barra de progreso
    const position = player.position || 0;
    const duration = current.length || 0;
    const BAR_LENGTH = 20;
    const filled = duration > 0 ? Math.round((position / duration) * BAR_LENGTH) : 0;
    const bar = "█".repeat(filled) + "░".repeat(BAR_LENGTH - filled);
    const progressText = `\`${formatDuration(position)}\` ${bar} \`${formatDuration(duration)}\``;

    const embed = nowPlayingEmbed(current, player, tier, language);
    embed.addFields({ name: t(language, "progress"), value: progressText });

    return interaction.editReply({ embeds: [embed] });
  },
};
