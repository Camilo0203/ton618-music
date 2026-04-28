"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { TIER_LIMITS } = require("../config/lavalinkConfig");
const { errorEmbed, warningEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");

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
    await interaction.deferReply();

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "volume_voice_required"), language)] });
    }

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.editReply({ embeds: [errorEmbed(t(language, "volume_no_player"), language)] });
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
      return interaction.editReply({ embeds: [warningEmbed(msg, tier, language)] });
    }

    await player.setVolume(requested);

    const emoji = requested === 0 ? "🔇" : requested < 30 ? "🔈" : requested < 70 ? "🔉" : "🔊";

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(t(language, "volume_set", { emoji }))
          .setDescription(t(language, "volume_set_desc", { volume: requested }))
          .setFooter({ text: tier === "pro" ? t(language, "tier_badge_pro") : t(language, "tier_badge_free") }),
      ],
    });
  },
};
