"use strict";

/**
 * MusicManager
 *
 * Gestiona los players de Lavalink por guild usando Shoukaku + Kazagumo.
 * Se encarga de:
 *   - Inicializar la conexión a los nodos (PRO y FREE)
 *   - Crear / recuperar players por guildId
 *   - Aplicar límites de tier (queue, volumen, duración, filtros)
 *   - Limpiar players inactivos automáticamente
 */

const { Kazagumo, Plugins } = require("kazagumo");
const { Shoukaku, Connectors } = require("shoukaku");
const { LAVALINK_NODES, TIER_LIMITS } = require("../config/lavalinkConfig");

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min sin actividad → destruir player

class MusicManager {
  constructor(client) {
    this.client = client;

    /** @type {Map<string, NodeJS.Timeout>} idleTimers por guildId */
    this.idleTimers = new Map();

    const nodes = [
      {
        name: LAVALINK_NODES.FREE.name,
        url: LAVALINK_NODES.FREE.url,
        auth: LAVALINK_NODES.FREE.auth,
        secure: LAVALINK_NODES.FREE.secure,
      },
    ];

    // Solo añadir nodo PRO si tiene configuración distinta
    if (LAVALINK_NODES.PRO.url !== LAVALINK_NODES.FREE.url) {
      nodes.unshift({
        name: LAVALINK_NODES.PRO.name,
        url: LAVALINK_NODES.PRO.url,
        auth: LAVALINK_NODES.PRO.auth,
        secure: LAVALINK_NODES.PRO.secure,
      });
    }

    this.kazagumo = new Kazagumo(
      {
        defaultSearchEngine: "youtube",
        send: (guildId, payload) => {
          const guild = this.client.guilds.cache.get(guildId);
          if (guild) guild.shard.send(payload);
        },
      },
      new Connectors.DiscordJS(client),
      nodes,
      {
        reconnectTries: 3,
        reconnectInterval: 5000,
        restTimeout: 10000,
        moveOnDisconnect: false,
        resumable: false,
        resumableTimeout: 30,
        resumeByKeyOnly: true,
        autoReconnect: true,
      }
    );

    this._registerEvents();
  }

  _registerEvents() {
    this.kazagumo.shoukaku.on("ready", (name) => {
      console.log(`[MusicManager] Lavalink node ready: ${name}`);
    });

    this.kazagumo.shoukaku.on("error", (name, error) => {
      console.error(`[MusicManager] Lavalink node error on ${name}:`, error?.message || error);
    });

    this.kazagumo.shoukaku.on("close", (name, code, reason) => {
      console.warn(`[MusicManager] Lavalink node closed: ${name} (${code}) — ${reason}`);
    });

    this.kazagumo.shoukaku.on("disconnect", (name, count) => {
      console.warn(`[MusicManager] Lavalink node disconnected: ${name}, players moved: ${count}`);
    });

    this.kazagumo.on("playerStart", (player, track) => {
      this._resetIdleTimer(player.guildId);
      console.log(`[MusicManager] [${player.guildId}] Playing: ${track.title}`);
    });

    this.kazagumo.on("playerEnd", (player) => {
      this._startIdleTimer(player.guildId);
    });

    this.kazagumo.on("playerEmpty", (player) => {
      this._startIdleTimer(player.guildId);
    });

    this.kazagumo.on("playerClosed", (player) => {
      this._clearIdleTimer(player.guildId);
    });

    this.kazagumo.on("playerError", (player, error) => {
      console.error(`[MusicManager] Player error [${player.guildId}]:`, error?.message || error);
    });
  }

  /**
   * Obtiene o crea un player para un guild.
   * @param {object} opts
   * @param {string} opts.guildId
   * @param {string} opts.voiceChannelId
   * @param {string} opts.textChannelId
   * @param {string} opts.tier  "pro" | "free"
   */
  async getOrCreatePlayer({ guildId, voiceChannelId, textChannelId, tier = "free" }) {
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    let player = this.kazagumo.players.get(guildId);

    if (!player) {
      player = await this.kazagumo.createPlayer({
        guildId,
        voiceId: voiceChannelId,
        textId: textChannelId,
        deaf: true,
        volume: Math.min(80, limits.maxVolume),
        nodeName: limits.lavalinkNode,
      });

      player.tier = tier;
      player.limits = limits;
      this._startIdleTimer(guildId);
    }

    return player;
  }

  /**
   * Busca pistas respetando las restricciones del tier.
   * @param {string} query    URL o término de búsqueda
   * @param {string} tier     "pro" | "free"
   * @returns {Promise<KazagumoSearchResult>}
   */
  async search(query, tier = "free") {
    const engine = tier === "pro" ? "youtube" : "youtube";
    return this.kazagumo.search(query, { engine });
  }

  /**
   * Pone una pista en cola, respetando los límites del tier.
   * @returns {{ ok: boolean, reason?: string }}
   */
  enqueue(player, track) {
    const limits = player.limits || TIER_LIMITS.free;

    if (player.queue.size >= limits.maxQueue) {
      return {
        ok: false,
        reason: `queue_full:${limits.maxQueue}`,
      };
    }

    if (
      track.length &&
      track.length / 1000 > limits.maxDurationSeconds
    ) {
      return {
        ok: false,
        reason: `too_long:${limits.maxDurationSeconds}`,
      };
    }

    player.queue.add(track);
    return { ok: true };
  }

  /**
   * Destruye el player de un guild y limpia timers.
   */
  async destroyPlayer(guildId) {
    this._clearIdleTimer(guildId);
    const player = this.kazagumo.players.get(guildId);
    if (player) {
      await player.destroy();
    }
  }

  /**
   * Aplica filtro de alta calidad (solo PRO).
   * Soporta: bassboost | nightcore | vaporwave | reset
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
      return { ok: false, reason: err?.message || "filter_error" };
    }
  }

  _startIdleTimer(guildId) {
    this._clearIdleTimer(guildId);
    const timer = setTimeout(() => {
      this.destroyPlayer(guildId).catch(() => {});
      console.log(`[MusicManager] Player idle timeout — destroyed: ${guildId}`);
    }, IDLE_TIMEOUT_MS);
    this.idleTimers.set(guildId, timer);
  }

  _resetIdleTimer(guildId) {
    this._clearIdleTimer(guildId);
  }

  _clearIdleTimer(guildId) {
    const t = this.idleTimers.get(guildId);
    if (t) {
      clearTimeout(t);
      this.idleTimers.delete(guildId);
    }
  }

  /** Estadísticas para health check */
  getStats() {
    const nodes = [...this.kazagumo.shoukaku.nodes.values()].map((n) => ({
      name: n.name,
      state: n.state,
      stats: n.stats,
    }));

    return {
      activePlayers: this.kazagumo.players.size,
      nodes,
    };
  }
}

module.exports = { MusicManager };
