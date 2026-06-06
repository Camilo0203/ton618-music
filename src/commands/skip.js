"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
} = require("../utils/musicEmbeds");
const { TIER_LIMITS } = require("../config/lavalinkConfig");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");

const log = createLogger("SkipCommand");

const data = new SlashCommandBuilder()
  .setName("skip")
  .setDescription("Salta la canción actual")
  .addIntegerOption((opt) =>
    opt
      .setName("cantidad")
      .setDescription("Cuántas pistas saltar (PRO: hasta 10)")
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false)
  );

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
        embeds: [createMusicErrorEmbed(t(language, "skip_voice_required"), language)],
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
    if (!player || (!player.playing && !player.paused)) {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "skip_nothing_playing"), language)],
      });
    }

    let tier;
    try {
      tier = await resolveGuildTier(guildId);
    } catch (err) {
      log.warn("Tier resolve failed, defaulting free", { guildId, error: err.message });
      tier = "free";
    }

    let amount = interaction.options.getInteger("cantidad") ?? 1;

    // FREE solo puede saltar de 1 en 1
    if (amount > 1 && tier === "free") {
      return safeRespond(interaction, {
        embeds: [
          createMusicWarningEmbed(
            t(language, "skip_pro_only", { url: process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing" }),
            tier,
            language
          ),
        ],
      });
    }

    const skipped = player.queue.current;
    const prevSize = player.queue.size;

    try {
      for (let i = 0; i < amount && player.queue.size > 0; i++) {
        await player.skip();
      }
    } catch (err) {
      log.error("Skip failed", { guildId, amount, error: err.message });
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "error_generic"), language)],
      });
    }

    log.info("Track(s) skipped", { guildId, userId: interaction.user.id, amount, skipped: skipped?.title });

    if (amount === 1 && skipped) {
      return safeRespond(interaction, {
        embeds: [
          createMusicSuccessEmbed(
            t(language, "skip_single"),
            t(language, "skip_single_desc", { title: skipped.title }),
            { language }
          ),
        ],
      });
    }

    return safeRespond(interaction, {
      embeds: [
        createMusicSuccessEmbed(
          t(language, "skip_multiple"),
          t(language, "skip_multiple_desc", { amount }),
          { language }
        ),
      ],
    });
  },
};
