"use strict";

/**
 * Configuración de nodos Lavalink por tier
 *
 * PRO   → nodo de alta calidad (bitrate 320kbps, búfer mayor)
 * FREE  → nodo de calidad estándar (bitrate 128kbps)
 *
 * Si solo tienes un nodo físico, puedes apuntar ambos al mismo host/puerto
 * y diferenciar la calidad vía los filtros de audio aplicados en MusicPlayer.
 */

function requireEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function getNode(prefix) {
  return {
    name: prefix.toLowerCase(),
    url: `${process.env[`LAVALINK_${prefix}_HOST`] || "localhost"}:${process.env[`LAVALINK_${prefix}_PORT`] || 2333}`,
    auth: process.env[`LAVALINK_${prefix}_PASSWORD`] || "youshallnotpass",
    secure: (process.env[`LAVALINK_${prefix}_SECURE`] || "false") === "true",
  };
}

const LAVALINK_NODES = {
  PRO: getNode("PRO"),
  FREE: getNode("FREE"),
};

/** Límites configurables por tier desde variables de entorno */
const TIER_LIMITS = {
  free: {
    maxQueue: parseInt(process.env.MUSIC_FREE_MAX_QUEUE || "10", 10),
    maxVolume: parseInt(process.env.MUSIC_FREE_MAX_VOLUME || "80", 10),
    maxDurationSeconds: parseInt(process.env.MUSIC_FREE_MAX_DURATION_SECONDS || "300", 10),
    bitrate: 128000,        // 128 kbps
    lavalinkNode: "free",
    filters: false,         // Filtros de audio deshabilitados en FREE
    spotifyEnabled: false,
    playlistEnabled: false,
  },
  pro: {
    maxQueue: parseInt(process.env.MUSIC_PRO_MAX_QUEUE || "200", 10),
    maxVolume: parseInt(process.env.MUSIC_PRO_MAX_VOLUME || "100", 10),
    maxDurationSeconds: parseInt(process.env.MUSIC_PRO_MAX_DURATION_SECONDS || "21600", 10),
    bitrate: 320000,        // 320 kbps
    lavalinkNode: "pro",
    filters: true,          // Equalizer, bassboost, nightcore, etc. disponibles
    spotifyEnabled: true,
    playlistEnabled: true,
  },
};

module.exports = { LAVALINK_NODES, TIER_LIMITS };
