"use strict";

/**
 * /loop — Repite la pista actual o la cola (PRO: cola, FREE: solo pista)
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { errorEmbed, warningEmbed } = require("../utils/musicEmbeds");

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

const LOOP_EMOJIS = { track: "🔂", queue: "🔁", none: "❌" };
const LOOP_LABELS = { track: "Pista", queue: "Cola", none: "Desactivado" };

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    await interaction.deferReply();

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.editReply({ embeds: [errorEmbed("No hay ningún player activo.")] });
    }

    const mode = interaction.options.getString("modo");
    const tier = await resolveGuildTier(interaction.guildId);

    if (mode === "queue" && tier !== "pro") {
      return interaction.editReply({
        embeds: [
          warningEmbed(
            `Repetir la cola completa es una función **PRO**. [Actualiza aquí](${UPGRADE_URL}).`,
            tier
          ),
        ],
      });
    }

    // Kazagumo loop modes: "none" | "track" | "queue"
    player.setLoop(mode);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(mode === "none" ? 0xed4245 : 0x5865f2)
          .setTitle(`${LOOP_EMOJIS[mode]} Loop ${LOOP_LABELS[mode]}`)
          .setDescription(
            mode === "none"
              ? "Repetición desactivada."
              : `Modo repetición: **${LOOP_LABELS[mode]}** activado.`
          )
          .setFooter({ text: tier === "pro" ? "✨ PRO" : "🆓 FREE" }),
      ],
    });
  },
};
