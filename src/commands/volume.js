"use strict";

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { TIER_LIMITS } = require("../config/lavalinkConfig");
const { errorEmbed, warningEmbed } = require("../utils/musicEmbeds");

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

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply({ embeds: [errorEmbed("Debes estar en un canal de voz.")] });
    }

    const musicManager = interaction.client.musicManager;
    const player = musicManager.kazagumo.players.get(interaction.guildId);

    if (!player) {
      return interaction.editReply({ embeds: [errorEmbed("No hay ningún player activo en este servidor.")] });
    }

    const tier = await resolveGuildTier(interaction.guildId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const requested = interaction.options.getInteger("nivel");

    if (requested > limits.maxVolume) {
      const msg =
        tier === "free"
          ? `El volumen máximo en FREE es **${limits.maxVolume}**. [Actualiza a PRO](${process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing"}) para llegar al 100%.`
          : `El volumen máximo es **${limits.maxVolume}**.`;
      return interaction.editReply({ embeds: [warningEmbed(msg, tier)] });
    }

    await player.setVolume(requested);

    const emoji = requested === 0 ? "🔇" : requested < 30 ? "🔈" : requested < 70 ? "🔉" : "🔊";

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${emoji} Volumen ajustado`)
          .setDescription(`Volumen: **${requested}**`)
          .setFooter({ text: tier === "pro" ? "✨ PRO" : "🆓 FREE" }),
      ],
    });
  },
};
