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

const { getTierLimitsFromEnv } = require("../shared");

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

/** Límites centralizados en @ton618/shared, sobreescribibles vía env vars */
const TIER_LIMITS = getTierLimitsFromEnv();

module.exports = { LAVALINK_NODES, TIER_LIMITS };
