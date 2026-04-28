"use strict";

/**
 * /musicstatus — Muestra el estado de los nodos Lavalink (Owner only)
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/musicEmbeds");
const { t, normalizeLanguage } = require("../utils/i18n");

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
    const NODE_STATE_LABEL = {
      0: t(language, "state_disconnected"),
      1: t(language, "state_connecting"),
      2: t(language, "state_connected"),
      3: t(language, "state_reconnecting"),
    };

    if (!OWNER_ID || interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        embeds: [errorEmbed(t(language, "musicstatus_owner_only"), language)],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const musicManager = interaction.client.musicManager;
    const stats = musicManager.getStats();

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(t(language, "musicstatus_title"))
      .addFields({
        name: t(language, "musicstatus_active_players"),
        value: String(stats.activePlayers),
        inline: true,
      });

    for (const node of stats.nodes) {
      const s = node.stats;
      embed.addFields({
        name: t(language, "musicstatus_node", { name: node.name }),
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
        ].join("\n"),
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
