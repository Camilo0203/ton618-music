"use strict";

/**
 * /musicstatus — Muestra el estado de los nodos Lavalink (Owner only)
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/musicEmbeds");

const OWNER_ID = process.env.OWNER_ID;

const data = new SlashCommandBuilder()
  .setName("musicstatus")
  .setDescription("Estado de los nodos Lavalink [Solo Owner]");

const NODE_STATE_LABEL = {
  0: "🔴 Desconectado",
  1: "🟡 Conectando",
  2: "🟢 Conectado",
  3: "🔵 Reconectando",
};

module.exports = {
  data,
  category: "music",
  ownerOnly: true,

  async execute(interaction) {
    if (!OWNER_ID || interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        embeds: [errorEmbed("Este comando es solo para el owner del bot.")],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const musicManager = interaction.client.musicManager;
    const stats = musicManager.getStats();

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎵 Estado del Sistema de Música")
      .addFields({
        name: "Players activos",
        value: String(stats.activePlayers),
        inline: true,
      });

    for (const node of stats.nodes) {
      const s = node.stats;
      embed.addFields({
        name: `Nodo: ${node.name}`,
        value: [
          `Estado: ${NODE_STATE_LABEL[node.state] ?? node.state}`,
          s
            ? [
                `Players: ${s.playingPlayers}/${s.players}`,
                `CPU: ${s.cpu ? (s.cpu.lavalinkLoad * 100).toFixed(1) + "%" : "N/A"}`,
                `Memoria: ${s.memory ? Math.round(s.memory.used / 1024 / 1024) + " MB" : "N/A"}`,
                `Uptime: ${s.uptime ? Math.floor(s.uptime / 60000) + " min" : "N/A"}`,
              ].join("\n")
            : "Sin estadísticas",
        ].join("\n"),
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
