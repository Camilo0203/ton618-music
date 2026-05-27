"use strict";

/**
 * MusicManager — Refactor 2025
 *
 * Gestiona players Lavalink por guild con:
 *   - Circuit breaker + health monitor
 *   - Manejo robusto de errores de track (403, anti-bot, URL expired)
 *   - Reconexión automática de nodos y voice
 *   - Fallback de búsqueda (youtube → soundcloud → direct HTTP)
 *   - Guild locks para evitar race conditions
 *   - Memory leak fixes (timer cleanup, event listener dedup)
 */

const { Kazagumo } = require("kazagumo");
const { Connectors } = require("shoukaku");
const { LAVALINK_NODES, TIER_LIMITS, CIRCUIT_BREAKER, TIMEOUTS } = require("../config/lavalinkConfig");
const { NodeHealthMonitor } = require("../services/NodeHealthMonitor");
const { TrackErrorHandler } = require("../services/TrackErrorHandler");
const { createLogger } = require("../utils/logger");

const log = createLogger("MusicManager");

const IDLE_TIMEOUT_MS = TIMEOUTS.playerIdle;
const MAX_RETRIES_SEARCH = 2;
const SEARCH_BACKOFF_MS = 1500;
const GUILD_LOCK_TIMEOUT_MS = 10000;
const NODE_READY_TIMEOUT_MS = 10000;

class MusicManager {
  constructor(client) {
    this.client = client;

    /** @type {Map<string, NodeJS.Timeout>} */
    this.idleTimers = new Map();

    /** @type {Map<string, Promise<void>>} guild locks */
    this.guildLocks = new Map();

    this.health = new NodeHealthMonitor();
    this.trackErrorHandler = null; // se inicializa después

    const singleNode = LAVALINK_NODES.PRO.url === LAVALINK_NODES.FREE.url;

    const nodes = [
      {
        name: LAVALINK_NODES.FREE.name,
        url: LAVALINK_NODES.FREE.url,
        auth: LAVALINK_NODES.FREE.auth,
        secure: LAVALINK_NODES.FREE.secure,
      },
    ];

    if (!singleNode) {
      nodes.unshift({
        name: LAVALINK_NODES.PRO.name,
        url: LAVALINK_NODES.PRO.url,
        auth: LAVALINK_NODES.PRO.auth,
        secure: LAVALINK_NODES.PRO.secure,
      });
    }

    this._nodeForTier = singleNode ? { pro: "free", free: "free" } : { pro: "pro", free: "free" };

    // Registrar nodos en health monitor
    for (const node of nodes) {
      this.health.registerNode(node.name, node.url);
    }

    this.kazagumo = new Kazagumo(
      {
        defaultSearchEngine: "youtube",
        send: (guildId, payload) => {
          const guild = this.client.guilds.cache.get(guildId);
          if (guild) guild.shard.send(payload);
        },
      },
      new Connectors.DiscordJS(this.client),
      nodes,
      {
        reconnectTries: parseInt(process.env.LAVALINK_RECONNECT_TRIES || "5", 10),
        reconnectInterval: parseInt(process.env.LAVALINK_RECONNECT_INTERVAL_MS || "5000", 10),
        restTimeout: parseInt(process.env.LAVALINK_REST_TIMEOUT_MS || "15000", 10),
        moveOnDisconnect: true, // mover players si un nodo cae
        resumable: true,
        resumableTimeout: 60,
        resumeByKeyOnly: false,
        autoReconnect: true,
      }
    );

    this.trackErrorHandler = new TrackErrorHandler(this, this.health);
    this._registerEvents();

    if (this.client.isReady?.() && this.kazagumo.shoukaku.nodes.size === 0) {
      this.kazagumo.shoukaku.id = this.client.user?.id || null;
      for (const node of nodes) {
        this.kazagumo.shoukaku.addNode(node);
      }
    }

    // Verificar estado de nodos después de 5s (el evento ready puede perderse si conecta antes de registrar listener)
    setTimeout(() => {
      const shoukaku = this.kazagumo.shoukaku;
      for (const [name, node] of shoukaku.nodes) {
        const connected = node.state === 1 || node.connected === true;
        log.info("Node state check", { name, state: node.state, connected });
        if (connected) {
          this.health.recordSuccess(name);
        }
      }
    }, 5000);
  }

  _registerEvents() {
    const shoukaku = this.kazagumo.shoukaku;

    shoukaku.on("ready", (name) => {
      log.info("Lavalink node ready", { name });
      this.health.recordSuccess(name);
    });

    shoukaku.on("error", (name, error) => {
      log.error("Lavalink node error", {
        name,
        error: error?.message || String(error),
        stack: error?.stack,
      });
      this.trackErrorHandler.handleNodeError(name, error);
    });

    shoukaku.on("close", (name, code, reason) => {
      log.warn("Lavalink node closed", { name, code, reason });
      this.health.recordFailure(name, "node_close");
    });

    shoukaku.on("disconnect", (name, count) => {
      log.warn("Lavalink node disconnected", { name, playersMoved: count });
      this.health.recordFailure(name, "node_disconnect");
    });

    // Eventos Kazagumo
    this.kazagumo.on("playerStart", (player, track) => {
      this._resetIdleTimer(player.guildId);
      this.health.recordSuccess(player.node.name || player.node);
      this.health.globalStats.totalTracksPlayed++;
      log.info("Track started", { guildId: player.guildId, title: track?.title, node: player.node?.name || player.node });
    });

    this.kazagumo.on("playerEnd", (player) => {
      this._startIdleTimer(player.guildId);
      log.debug("Track ended", { guildId: player.guildId });
    });

    this.kazagumo.on("playerEmpty", (player) => {
      this._startIdleTimer(player.guildId);
      log.debug("Queue empty", { guildId: player.guildId });
    });

    this.kazagumo.on("playerClosed", (player) => {
      this._clearIdleTimer(player.guildId);
      log.info("Player closed", { guildId: player.guildId });
    });

    this.kazagumo.on("playerError", (player, error) => {
      log.error("Player error event", { guildId: player.guildId, error: error?.message || String(error) });
      this.trackErrorHandler.handleTrackError(player, player.queue.current, error).catch((err) => {
        log.error("TrackErrorHandler failed", { guildId: player.guildId, error: err.message });
      });
    });

    // Evento de actualización de player (monitoreo de posición/stuck)
    this.kazagumo.on("playerUpdate", (player) => {
      this._resetIdleTimer(player.guildId);
    });
  }

  _getConnectedNodeName(preferredName) {
    const nodes = [...this.kazagumo.shoukaku.nodes.values()];
    const connectedNodes = nodes.filter((node) => node.state === 1 || node.connected === true);
    const preferredNode = connectedNodes.find((node) => node.name === preferredName);
    return (preferredNode || connectedNodes[0])?.name || null;
  }

  async _waitForConnectedNode(preferredName, timeoutMs = NODE_READY_TIMEOUT_MS) {
    const start = Date.now();
    let nodeName = this._getConnectedNodeName(preferredName);

    while (!nodeName && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      nodeName = this._getConnectedNodeName(preferredName);
    }

    if (!nodeName) {
      const nodes = [...this.kazagumo.shoukaku.nodes.values()].map((node) => ({
        name: node.name,
        state: node.state,
      }));
      log.error("No connected Lavalink nodes available", { preferredName, nodes });
      throw new Error("No connected Lavalink nodes available");
    }

    return nodeName;
  }

  /**
   * Adquiere un lock por guild para evitar race conditions.
   */
  async _acquireGuildLock(guildId) {
    const start = Date.now();
    while (this.guildLocks.has(guildId)) {
      if (Date.now() - start > GUILD_LOCK_TIMEOUT_MS) {
        throw new Error(`Guild lock timeout for ${guildId}`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    let resolveLock;
    const lockPromise = new Promise((resolve) => {
      resolveLock = resolve;
    });
    this.guildLocks.set(guildId, lockPromise);

    return () => {
      this.guildLocks.delete(guildId);
      resolveLock();
    };
  }

  /**
   * Obtiene o crea un player para un guild, con lock.
   */
  async getOrCreatePlayer({ guildId, voiceChannelId, textChannelId, shardId = 0, tier = "free" }) {
    const release = await this._acquireGuildLock(guildId);
    try {
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      let player = this.kazagumo.players.get(guildId);

      if (!player) {
        const nodeName = this._nodeForTier[tier] || "free";
        const bestNode = await this._waitForConnectedNode(nodeName);

        player = await this.kazagumo.createPlayer({
          guildId,
          voiceId: voiceChannelId,
          textId: textChannelId,
          deaf: true,
          shardId,
          volume: Math.min(80, limits.maxVolume),
          nodeName: bestNode,
          loadBalancer: false,
        });

        player.tier = tier;
        player.limits = limits;
        player.createdAt = Date.now();
        this._startIdleTimer(guildId);
        log.info("Player created", { guildId, tier, node: bestNode });
      } else if (player.voiceId !== voiceChannelId) {
        // Usuario cambió de canal, mover player
        try {
          await player.setVoiceChannel(voiceChannelId);
          log.info("Player moved voice channel", { guildId, newChannel: voiceChannelId });
        } catch (err) {
          log.warn("Failed to move player voice channel", { guildId, error: err.message });
        }
      }

      return player;
    } finally {
      release();
    }
  }

  /**
   * Búsqueda con retry y fallback de engines.
   * Intenta: youtube → soundcloud → ytsearch directo
   */
  async search(query, tier = "free") {
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const engines = ["youtube", "soundcloud"];
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES_SEARCH; attempt++) {
      for (const engine of engines) {
        try {
          const nodeName = this._nodeForTier[tier] || "free";
          const bestNode = await this._waitForConnectedNode(nodeName);

          log.debug("Searching", { engine, query: query.slice(0, 60), node: bestNode, attempt });
          const results = await this.kazagumo.search(query, { engine });

          if (results?.tracks?.length) {
            // Filtrar por duración
            if (limits.maxDurationSeconds) {
              results.tracks = results.tracks.filter(
                (t) => !t.length || t.length / 1000 <= limits.maxDurationSeconds
              );
            }
            this.health.recordSuccess(bestNode);
            return results;
          }
        } catch (err) {
          lastError = err;
          this.health.recordFailure(this._nodeForTier[tier] || "free", "search_failure");
          log.warn("Search attempt failed", { engine, attempt, error: err.message });
        }
      }

      if (attempt < MAX_RETRIES_SEARCH - 1) {
        await new Promise((r) => setTimeout(r, SEARCH_BACKOFF_MS * (attempt + 1)));
      }
    }

    // Si todo falla, propagar error con contexto
    const enhancedError = new Error(`Search failed after ${MAX_RETRIES_SEARCH} attempts: ${lastError?.message || "unknown"}`);
    enhancedError.cause = lastError;
    throw enhancedError;
  }

  /**
   * Encola una pista respetando límites de tier.
   * @returns {{ ok: boolean, reason?: string }}
   */
  enqueue(player, track) {
    const limits = player.limits || TIER_LIMITS.free;

    if (player.queue.size >= limits.maxQueue) {
      return { ok: false, reason: `queue_full:${limits.maxQueue}` };
    }

    if (track.length && track.length / 1000 > limits.maxDurationSeconds) {
      return { ok: false, reason: `too_long:${limits.maxDurationSeconds}` };
    }

    player.queue.add(track);
    return { ok: true };
  }

  /**
   * Destruye player y limpia todos los recursos asociados.
   */
  async destroyPlayer(guildId) {
    this._clearIdleTimer(guildId);
    this._clearAloneTimer(guildId);

    const player = this.kazagumo.players.get(guildId);
    if (player) {
      try {
        await player.destroy();
        log.info("Player destroyed", { guildId });
      } catch (err) {
        log.warn("Error destroying player", { guildId, error: err.message });
        // Forzar limpieza interna si destroy falla
        this.kazagumo.players.delete(guildId);
      }
    }
  }

  /**
   * Aplica filtros de audio (solo PRO).
   */
  async applyFilter(player, filterName) {
    if (!player.limits?.filters) {
      return { ok: false, reason: "filters_pro_only" };
    }

    const filters = {
      bassboost: {
        equalizer: [
          { band: 0, gain: 0.6 },
          { band: 1, gain: 0.7 },
          { band: 2, gain: 0.35 },
          { band: 3, gain: 0.2 },
          { band: 4, gain: 0.15 },
        ],
      },
      nightcore: {
        timescale: { speed: 1.3, pitch: 1.3, rate: 1.0 },
      },
      vaporwave: {
        timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 },
        equalizer: [
          { band: 1, gain: 0.3 },
          { band: 0, gain: 0.3 },
        ],
      },
      reset: {},
    };

    const preset = filters[filterName];
    if (!preset) return { ok: false, reason: "unknown_filter" };

    try {
      await player.shoukaku.setFilters(preset);
      return { ok: true };
    } catch (err) {
      log.error("Filter apply failed", { guildId: player.guildId, filter: filterName, error: err.message });
      return { ok: false, reason: err?.message || "filter_error" };
    }
  }

  // ---- Timer management ----

  _startIdleTimer(guildId) {
    this._clearIdleTimer(guildId);
    const timer = setTimeout(() => {
      log.info("Player idle timeout reached", { guildId });
      this.destroyPlayer(guildId).catch((err) => {
        log.error("Failed to destroy idle player", { guildId, error: err.message });
      });
    }, IDLE_TIMEOUT_MS);
    this.idleTimers.set(guildId, timer);
  }

  _resetIdleTimer(guildId) {
    this._clearIdleTimer(guildId);
    this._startIdleTimer(guildId);
  }

  _clearIdleTimer(guildId) {
    const t = this.idleTimers.get(guildId);
    if (t) {
      clearTimeout(t);
      this.idleTimers.delete(guildId);
    }
  }

  _clearAloneTimer(guildId) {
    // placeholder para VoiceStateMonitor que accede a esto si fuera necesario
    // actualmente VoiceStateMonitor maneja sus propios timers
  }

  // ---- Stats ----

  getStats() {
    const nodes = [...this.kazagumo.shoukaku.nodes.values()].map((n) => ({
      name: n.name,
      state: n.state,
      stats: n.stats,
      health: this.health.nodes.get(n.name),
    }));

    const healthReport = this.health.getHealthReport();

    return {
      activePlayers: this.kazagumo.players.size,
      idleTimers: this.idleTimers.size,
      guildLocks: this.guildLocks.size,
      nodes,
      health: healthReport,
    };
  }
}

module.exports = { MusicManager };
