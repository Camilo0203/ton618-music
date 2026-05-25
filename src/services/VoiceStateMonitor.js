"use strict";

/**
 * VoiceStateMonitor
 *
 * Maneja eventos de Discord voice state para:
 *  - Limpiar players cuando el bot es desconectado del canal
 *  - Limpiar players cuando todos los humanos se van
 *  - Reconectar automáticamente si el bot fue kickeado temporalmente
 *  - Monitorear sesiones zombie de voz
 */

const { createLogger } = require("../utils/logger");

const log = createLogger("VoiceStateMonitor");

const ZOMBIE_CHECK_MS = 30000;
const ALONE_TIMEOUT_MS = parseInt(process.env.VOICE_ALONE_TIMEOUT_MS || "60000", 10); // 1 min solo

class VoiceStateMonitor {
  constructor(client, musicManager) {
    this.client = client;
    this.musicManager = musicManager;
    this.aloneTimers = new Map();
    this.zombieInterval = null;
    this._voiceHandler = null;
  }

  start() {
    this._voiceHandler = (oldState, newState) => this._handleVoiceStateUpdate(oldState, newState);
    this.client.on("voiceStateUpdate", this._voiceHandler);

    // Chequeo periódico de sesiones zombie
    this.zombieInterval = setInterval(() => this._checkZombieSessions(), ZOMBIE_CHECK_MS);

    log.info("VoiceStateMonitor started");
  }

  stop() {
    if (this._voiceHandler) {
      this.client.removeListener("voiceStateUpdate", this._voiceHandler);
      this._voiceHandler = null;
    }
    if (this.zombieInterval) {
      clearInterval(this.zombieInterval);
      this.zombieInterval = null;
    }
    for (const timer of this.aloneTimers.values()) {
      clearTimeout(timer);
    }
    this.aloneTimers.clear();
  }

  _handleVoiceStateUpdate(oldState, newState) {
    const guildId = oldState.guild?.id || newState.guild?.id;
    if (!guildId) return;

    const player = this.musicManager.kazagumo?.players?.get(guildId);
    if (!player) return;

    const botId = this.client.user.id;

    // Caso 1: El bot fue desconectado del canal
    if (oldState.member?.id === botId && oldState.channelId && !newState.channelId) {
      log.info("Bot was disconnected from voice channel", { guildId, channelId: oldState.channelId });
      this._scheduleDestroy(guildId, 5000, "bot_disconnected");
      return;
    }

    // Caso 2: El bot cambió de canal (no debería pasar normalmente, pero manejamos)
    if (oldState.member?.id === botId && oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      log.info("Bot moved voice channel", { guildId, from: oldState.channelId, to: newState.channelId });
      // Actualizar player con nuevo canal
      try {
        player.setVoiceChannel(newState.channelId);
      } catch (err) {
        log.warn("Failed to update player voice channel", { guildId, error: err.message });
      }
      return;
    }

    // Caso 3: Chequear si el bot quedó solo en el canal
    const voiceChannel = this.client.channels.cache.get(player.voiceId);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
      const humans = voiceChannel.members.filter((m) => !m.user.bot);
      if (humans.size === 0) {
        this._startAloneTimer(guildId);
      } else {
        this._clearAloneTimer(guildId);
      }
    }
  }

  _startAloneTimer(guildId) {
    if (this.aloneTimers.has(guildId)) return;

    log.info("Bot alone in voice channel, starting timeout", { guildId, timeoutMs: ALONE_TIMEOUT_MS });
    const timer = setTimeout(() => {
      log.info("Destroying player due to alone timeout", { guildId });
      this.musicManager.destroyPlayer(guildId).catch((err) => {
        log.warn("Failed to destroy alone player", { guildId, error: err.message });
      });
      this.aloneTimers.delete(guildId);
    }, ALONE_TIMEOUT_MS);

    this.aloneTimers.set(guildId, timer);
  }

  _clearAloneTimer(guildId) {
    const timer = this.aloneTimers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.aloneTimers.delete(guildId);
    }
  }

  _scheduleDestroy(guildId, delayMs, reason) {
    setTimeout(() => {
      const player = this.musicManager.kazagumo?.players?.get(guildId);
      if (player) {
        log.info("Destroying player after delay", { guildId, reason });
        this.musicManager.destroyPlayer(guildId).catch(() => {});
      }
    }, delayMs);
  }

  _checkZombieSessions() {
    const players = this.musicManager.kazagumo?.players;
    if (!players) return;

    for (const [guildId, player] of players) {
      try {
        // Verificar si el bot sigue en el canal de voz
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) continue;

        const botMember = guild.members.me;
        if (!botMember?.voice?.channelId) {
          // Bot no está en ningún canal de voz pero hay player activo = zombie
          if (player.playing || player.paused || player.queue.size > 0) {
            log.warn("Detected zombie player, destroying", { guildId });
            this.musicManager.destroyPlayer(guildId).catch(() => {});
          }
          continue;
        }

        // Verificar que el estado del player sea consistente
        const connectionState = botMember.voice.connection?.state?.status;
        if (connectionState === "disconnected" && (player.playing || player.paused)) {
          log.warn("Player active but voice disconnected, destroying", { guildId });
          this.musicManager.destroyPlayer(guildId).catch(() => {});
        }
      } catch (err) {
        log.error("Error in zombie check", { guildId, error: err.message });
      }
    }
  }
}

module.exports = { VoiceStateMonitor };
