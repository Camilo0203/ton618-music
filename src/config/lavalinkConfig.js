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
  const password = process.env[`LAVALINK_${prefix}_PASSWORD`];
  if (!password && process.env.NODE_ENV !== "test") {
    throw new Error(
      `LAVALINK_${prefix}_PASSWORD is required. ` +
      `Never use the default Lavalink password in production. ` +
      `Generate a strong password and set it in your .env file.`
    );
  }
  const rawHost = process.env[`LAVALINK_${prefix}_HOST`] || "localhost";
  const defaultPort = prefix === "FREE" ? 2334 : 2333;
  const port = process.env[`LAVALINK_${prefix}_PORT`] || defaultPort;
  const host = rawHost.includes(":") ? `[${rawHost}]` : rawHost;
  return {
    name: prefix.toLowerCase(),
    url: `${host}:${port}`,
    auth: password || "test-password",
    secure: (process.env[`LAVALINK_${prefix}_SECURE`] || "false") === "true",
  };
}

const LAVALINK_NODES = {
  PRO: getNode("PRO"),
  FREE: getNode("FREE"),
};

/** Límites centralizados en @ton618/shared, sobreescribibles vía env vars */
const TIER_LIMITS = getTierLimitsFromEnv();

/** Configuración de circuit breaker para nodos Lavalink */
const CIRCUIT_BREAKER = {
  threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "5", 10),
  resetMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS || "60000", 10),
};

/** Timeouts y límites de reintentos */
const TIMEOUTS = {
  playerIdle: parseInt(process.env.PLAYER_IDLE_TIMEOUT_MS || "180000", 10),
  trackMaxRetries: parseInt(process.env.TRACK_MAX_RETRIES || "3", 10),
  tierResolve: parseInt(process.env.TIER_RESOLVE_TIMEOUT_MS || "3000", 10),
};

module.exports = { LAVALINK_NODES, TIER_LIMITS, CIRCUIT_BREAKER, TIMEOUTS };
