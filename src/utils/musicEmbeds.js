"use strict";

/**
 * Embeds de música para respuestas de Discord
 */

const { EmbedBuilder } = require("discord.js");

const COLOR_PRO = 0x5865f2;   // Blurple — tier PRO
const COLOR_FREE = 0x57f287;  // Verde — tier FREE
const COLOR_ERROR = 0xed4245;
const COLOR_WARNING = 0xfee75c;

function tierColor(tier) {
  return tier === "pro" ? COLOR_PRO : COLOR_FREE;
}

function tierBadge(tier) {
  return tier === "pro" ? "✨ PRO" : "🆓 FREE";
}

function formatDuration(ms) {
  if (!ms) return "∞";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function nowPlayingEmbed(track, player, tier) {
  const embed = new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle("▶ Reproduciendo ahora")
    .setDescription(`**[${track.title}](${track.uri})**`)
    .addFields(
      { name: "Duración", value: formatDuration(track.length), inline: true },
      { name: "Autor", value: track.author || "Desconocido", inline: true },
      { name: "Cola restante", value: `${player.queue.size} pistas`, inline: true }
    )
    .setFooter({ text: `${tierBadge(tier)} · Solicitado por ${track.requester?.tag || "Desconocido"}` });

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

function addedToQueueEmbed(track, position, tier) {
  return new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle("➕ Añadido a la cola")
    .setDescription(`**[${track.title}](${track.uri})**`)
    .addFields(
      { name: "Posición en cola", value: `#${position}`, inline: true },
      { name: "Duración", value: formatDuration(track.length), inline: true }
    )
    .setFooter({ text: tierBadge(tier) });
}

function playlistAddedEmbed(playlistName, count, tier) {
  return new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle("📋 Playlist añadida")
    .setDescription(`**${playlistName}** — ${count} pistas añadidas a la cola`)
    .setFooter({ text: tierBadge(tier) });
}

function queueEmbed(player, tier, page = 1) {
  const perPage = 10;
  const queue = player.queue.tracks ?? [...player.queue];
  const totalPages = Math.max(1, Math.ceil(queue.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = queue.slice((safePage - 1) * perPage, safePage * perPage);

  const current = player.queue.current;

  const embed = new EmbedBuilder()
    .setColor(tierColor(tier))
    .setTitle("📋 Cola de reproducción")
    .setFooter({ text: `Página ${safePage}/${totalPages} · ${queue.length} pistas · ${tierBadge(tier)}` });

  if (current) {
    embed.addFields({
      name: "▶ Ahora",
      value: `[${current.title}](${current.uri}) — ${formatDuration(current.length)}`,
    });
  }

  if (slice.length === 0) {
    embed.setDescription("La cola está vacía.");
  } else {
    const lines = slice.map(
      (t, i) =>
        `**${(safePage - 1) * perPage + i + 1}.** [${t.title}](${t.uri}) — ${formatDuration(t.length)}`
    );
    embed.setDescription(lines.join("\n"));
  }

  return embed;
}

function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("❌ Error")
    .setDescription(message);
}

function warningEmbed(message, tier) {
  return new EmbedBuilder()
    .setColor(COLOR_WARNING)
    .setTitle("⚠️ Aviso")
    .setDescription(message)
    .setFooter({ text: tier ? tierBadge(tier) : "" });
}

function proOnlyEmbed(featureName, upgradeUrl) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_PRO)
    .setTitle("🔒 Función exclusiva PRO")
    .setDescription(
      `**${featureName}** requiere TON618 Pro.\n\n` +
      "Desbloquea música en **alta calidad (320kbps)**, colas largas, filtros de audio y playlists completas."
    );

  if (upgradeUrl) {
    embed.addFields({ name: "💎 Actualizar", value: `[Ver planes](${upgradeUrl})` });
  }

  return embed;
}

module.exports = {
  nowPlayingEmbed,
  addedToQueueEmbed,
  playlistAddedEmbed,
  queueEmbed,
  errorEmbed,
  warningEmbed,
  proOnlyEmbed,
  formatDuration,
  tierBadge,
};
