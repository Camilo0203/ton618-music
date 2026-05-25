"use strict";

/**
 * /musicstatus — Muestra el estado de los nodos Lavalink (Owner only)
 * Refactor 2025: logging estructurado, manejo de errores, info de circuit breaker
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");

const log = createLogger("MusicStatusCommand");
const OWNER_ID = process.env.OWNER_ID;

const data = new SlashCommandBuilder()
  .setName("musicstatus")
  .setDescription("Estado de los nodos Lavalink [Solo Owner]");

module.exports = {
  data,
  category: "music",
  ownerOnly: true,

  async execute(interaction) {
    const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");
    const guildId = interaction.guildId;
    const NODE_STATE_LABEL = {
      0: t(language, "state_disconnected"),
      1: t(language, "state_connecting"),
      2: t(language, "state_connected"),
      3: t(language, "state_reconnecting"),
    };

    if (!OWNER_ID || interaction.user.id !== OWNER_ID) {
      log.warn("Unauthorized musicstatus access attempt", { userId: interaction.user.id, guildId });
      return interaction.reply({
        embeds: [errorEmbed(t(language, "musicstatus_owner_only"), language)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const musicManager = interaction.client.musicManager;
    if (!musicManager) {
      log.error("musicManager not available", { guildId });
      return interaction.editReply({ embeds: [errorEmbed(t(language, "error_lavalink"), language)] });
    }

    let stats;
    try {
      stats = musicManager.getStats();
    } catch (err) {
      log.error("Failed to get stats", { guildId, error: err.message });
      return interaction.editReply({ embeds: [errorEmbed(t(language, "error_generic"), language)] });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t(language, "musicstatus_title"))
      .setTimestamp()
      .addFields({
        name: t(language, "musicstatus_active_players"),
        value: String(stats.activePlayers),
        inline: true,
      }, {
        name: "Idle Timers",
        value: String(stats.idleTimers),
        inline: true,
      }, {
        name: "Guild Locks",
        value: String(stats.guildLocks),
        inline: true,
      });

    for (const node of stats.nodes) {
      const s = node.stats;
      const health = node.health || {};
      embed.addFields({
        name: `${node.name} ${health.circuitState === "OPEN" ? "🔴 CB OPEN" : health.consecutiveFailures > 0 ? "🟡 DEGRADED" : "🟢 OK"}`,
        value: [
          `${t(language, "musicstatus_state")}: ${NODE_STATE_LABEL[node.state] ?? node.state}`,
          s
            ? [
                `${t(language, "musicstatus_players")}: ${s.playingPlayers}/${s.players}`,
                `${t(language, "musicstatus_cpu")}: ${s.cpu ? (s.cpu.lavalinkLoad * 100).toFixed(1) + "%" : "N/A"}`,
                `${t(language, "musicstatus_memory")}: ${s.memory ? Math.round(s.memory.used / 1024 / 1024) + " MB" : "N/A"}`,
                `Uptime: ${s.uptime ? Math.floor(s.uptime / 60000) + " min" : "N/A"}`,
              ].join("\n")
            : "N/A",
          health.consecutiveFailures ? `Consecutive failures: ${health.consecutiveFailures}` : "",
          health.lastFailureAt ? `Last failure: ${new Date(health.lastFailureAt).toISOString()}` : "",
        ].filter(Boolean).join("\n"),
        inline: false,
      });
    }

    log.info("musicstatus queried", { guildId, userId: interaction.user.id });
    return interaction.editReply({ embeds: [embed] });
  },
};
