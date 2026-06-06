"use strict";

/**
 * /loop — Repite la pista actual o la cola (PRO: cola, FREE: solo pista)
 */

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const {
  COLORS,
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
} = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");
const { MusicControlService } = require("../services/MusicControlService");

const log = createLogger("LoopCommand");
const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";

const data = new SlashCommandBuilder()
  .setName("loop")
  .setDescription("Activa o desactiva el modo de repetición")
  .addStringOption((opt) =>
    opt
      .setName("modo")
      .setDescription("Modo de repetición")
      .setRequired(true)
      .addChoices(
        { name: "🔂 Pista (repetir la canción actual)", value: "track" },
        { name: "🔁 Cola (repetir toda la cola) [PRO]", value: "queue" },
        { name: "❌ Desactivar", value: "none" }
      )
  );

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const LOOP_LABELS = {
      track: t(language, "label_track"),
      queue: t(language, "label_queue"),
      none: t(language, "label_disabled"),
    };

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
        embeds: [createMusicErrorEmbed(t(language, "loop_no_player"), language)],
      });
    }

    const mode = interaction.options.getString("modo");
    const tier = await resolveGuildTier(interaction.guildId);

    if (mode === "queue" && tier !== "pro") {
      return safeRespond(interaction, {
        embeds: [
          createMusicWarningEmbed(
            t(language, "loop_queue_pro_only", { url: UPGRADE_URL }),
            tier,
            language
          ),
        ],
      });
    }

    // Kazagumo loop modes: "none" | "track" | "queue"
    const controlService = new MusicControlService(musicManager);
    controlService.setLoop(player, mode);

    return safeRespond(interaction, {
      embeds: [
        createMusicSuccessEmbed(
          t(language, "loop_set", { label: LOOP_LABELS[mode] }),
          t(language, "loop_set_desc", { mode: LOOP_LABELS[mode] }),
          {
            color: mode === "none" ? COLORS.NEUTRAL : COLORS.PLAYING,
            tier,
            language,
          }
        ),
      ],
    });
  },
};
