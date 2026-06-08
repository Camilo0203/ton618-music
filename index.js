"use strict";

/**
 * TON618 Music Module — Entry Point (Refactor 2025)
 *
 * A) INDEPENDIENTE: proceso Node.js separado
 * B) INTEGRADO: importar MusicManager y musicInteractionHandler desde ton618-bot
 */

require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { MusicManager } = require("./src/music/MusicManager");
const { musicInteractionHandler } = require("./src/handlers/musicInteractionHandler");
const { VoiceStateMonitor } = require("./src/services/VoiceStateMonitor");
const { YouTubeTokenService } = require("./src/services/YouTubeTokenService");
const { LavaliinkFailoverService } = require("./src/services/LavaliinkFailoverService");
const { SearchCacheService } = require("./src/services/SearchCacheService");
const { createLogger } = require("./src/utils/logger");

const log = createLogger("Main");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  log.error("DISCORD_TOKEN no está configurado en .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

const youtubeTokenService = new YouTubeTokenService();
let voiceMonitor = null;

// Initialize failover service BEFORE MusicManager
const failoverService = new LavaliinkFailoverService(client, {
  healthCheckInterval: 30000,      // Check every 30s
  healthCheckTimeout: 5000,        // 5s timeout per check
  failureThreshold: 3,              // Switch after 3 failures
  recoveryRetries: 5,               // Try 5 times to recover
});

// Listen to failover events
failoverService.on('failover', (event) => {
  log.error('LAVALINK FAILOVER TRIGGERED', {
    from: event.from,
    to: event.to,
    timestamp: event.timestamp,
  });
});

failoverService.on('nodeRecovered', (event) => {
  log.info('Lavalink node recovered', { node: event.node });
});

failoverService.on('recoveryFailed', (event) => {
  log.error('Lavalink node recovery FAILED', { node: event.node });
});

failoverService.on('criticalFailure', (event) => {
  log.error('CRITICAL: ALL LAVALINK NODES FAILED', event);
});

client.musicManager = new MusicManager(client);
client.failoverService = failoverService;
client.searchCache = new SearchCacheService({
  cacheTTL: 3600000,  // 1 hour
  maxSessionTTL: 300000, // 5 minutes
});

voiceMonitor = new VoiceStateMonitor(client, client.musicManager);
voiceMonitor.start();

client.once("clientReady", async () => {
  log.info("Client ready", { tag: client.user.tag, guilds: client.guilds.cache.size });

  // Initialize Lavalink failover service
  try {
    await failoverService.init();
    log.info("Lavalink failover service initialized", {
      primary: failoverService.state.activePrimary,
      fallback: failoverService.state.activeFallback,
    });
  } catch (err) {
    log.error("Failed to initialize failover service", { error: err.message });
  }

  // Iniciar servicio de tokens de YouTube (en background, no bloquea startup)
  youtubeTokenService.start().catch((err) => {
    log.warn("YouTubeTokenService failed to start, continuing without tokens", { error: err.message });
  });

  // Health check heartbeat with failover status
  setInterval(() => {
    const stats = client.musicManager.getStats();
    const failoverStatus = failoverService.getStatus();
    log.debug("Health heartbeat", {
      players: stats.activePlayers,
      idleTimers: stats.idleTimers,
      guildLocks: stats.guildLocks,
      nodes: stats.nodes.map((n) => ({ name: n.name, state: n.state })),
      lavalink: {
        activePrimary: failoverStatus.activePrimary,
        activeFallback: failoverStatus.activeFallback,
        primaryHealth: failoverStatus.nodes[failoverStatus.activePrimary]?.status,
      },
    });
  }, 60000);
});

// Manejo de errores de conexión de Discord
client.on("shardError", (error) => {
  log.error("Discord shard error", { error: error.message });
});

client.on("error", (error) => {
  log.error("Discord client error", { error: error.message });
});

client.on("interactionCreate", musicInteractionHandler);

// ---- Global error handling ----

process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled rejection", { reason: reason?.message || String(reason) });
});

process.on("uncaughtException", (err) => {
  log.error("Uncaught exception", { error: err.message, stack: err.stack });
  // Dar tiempo a que los logs se flush antes de salir
  setTimeout(() => process.exit(1), 500);
});

process.on("warning", (warning) => {
  log.warn("Node warning", { name: warning.name, message: warning.message });
});

// ---- Graceful shutdown ----
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("Shutdown initiated", { signal });

  // Stop failover service
  try {
    failoverService.stop();
    log.info("Lavalink failover service stopped");
  } catch (err) {
    log.warn("Error stopping failover service", { error: err.message });
  }

  // Stop search cache service
  try {
    if (client.searchCache) {
      client.searchCache.destroy();
      log.info("Search cache service stopped");
    }
  } catch (err) {
    log.warn("Error stopping search cache service", { error: err.message });
  }

  // Detener aceptación de nuevas interacciones
  client.removeAllListeners("interactionCreate");

  try {
    if (voiceMonitor) voiceMonitor.stop();
    youtubeTokenService.stop();
  } catch (err) {
    log.warn("Error stopping monitors", { error: err.message });
  }

  try {
    if (client.musicManager) {
      const playerIds = [...client.musicManager.kazagumo.players.keys()];
      log.info("Destroying players before shutdown", { count: playerIds.length });
      await Promise.allSettled(playerIds.map((id) => client.musicManager.destroyPlayer(id)));
    }
  } catch (err) {
    log.error("Error destroying players", { error: err.message });
  }

  try {
    client.destroy();
    log.info("Client destroyed");
  } catch (err) {
    log.error("Error destroying client", { error: err.message });
  }

  // Flush logs de Winston
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Windows no soporta SIGTERM de forma nativa en Node
if (process.platform === "win32") {
  process.on("message", (msg) => {
    if (msg === "shutdown") shutdown("MSG_SHUTDOWN");
  });
}

client.login(TOKEN).catch((err) => {
  log.error("Login failed", { error: err?.message || String(err) });
  process.exit(1);
});

module.exports = { client };
