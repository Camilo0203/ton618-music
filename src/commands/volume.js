"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { TIER_LIMITS } = require("../config/lavalinkConfig");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
} = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");

const log = createLogger("VolumeCommand");

const data = new SlashCommandBuilder()
  .setName("volume")
  .setDescription("Ajusta el volumen de reproducción")
  .addIntegerOption((opt) =>
    opt
      .setName("nivel")
      .setDescription("Nivel de volumen (FREE: 1-80, PRO: 1-100)")
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(true)
  );

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const voiceChannel = interaction.guild?.members?.cache?.get(interaction.user.id)?.voice?.channel;
    if (!voiceChannel) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "volume_voice_required"), language)],
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
        embeds: [createMusicErrorEmbed(t(language, "volume_no_player"), language)],
      });
    }

    const tier = await resolveGuildTier(interaction.guildId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const requested = interaction.options.getInteger("nivel");
    const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";

    if (requested > limits.maxVolume) {
      const msg =
        tier === "free"
          ? t(language, "volume_free_max", { max: limits.maxVolume, url: UPGRADE_URL })
          : t(language, "volume_pro_max", { max: limits.maxVolume });
      return safeRespond(interaction, {
        embeds: [createMusicWarningEmbed(msg, tier, language)],
      });
    }

    await player.setVolume(requested);

    return safeRespond(interaction, {
      embeds: [
        createMusicSuccessEmbed(
          t(language, "volume_set"),
          t(language, "volume_set_desc", { volume: requested }),
          { tier, language }
        ),
      ],
    });
  },
};
