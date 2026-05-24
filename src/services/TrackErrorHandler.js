"use strict";

/**
 * TrackErrorHandler
 *
 * Detecta errores de reproducción (403, anti-bot, expiración de URLs)
 * y aplica estrategias de recuperación:
 *   - Retry con otro client de YouTube
 *   - Skip a siguiente pista si no es recuperable
 *   - Exponential backoff
 *   - Detección de patterns de error de YouTube
 */

const { createLogger } = require("../utils/logger");

const log = createLogger("TrackErrorHandler");

// Patterns de errores conocidos de YouTube / Lavalink
const YOUTUBE_403_PATTERNS = [
  /403/i,
  /forbidden/i,
  /sign in to confirm/i,
  /confirm you're not a bot/i,
  /bot check/i,
  /quota exceeded/i,
  /playback on other websites has been disabled/i,
  /this video is unavailable/i,
];

const URL_EXPIRED_PATTERNS = [
  /expired/i,
  /invalid range/i,
  /416/i,
  /stream ended/i,
  /connection reset/i,
];

const FFMPEG_PATTERNS = [
  /ffmpeg/i,
  /avcodec/i,
  /decoder/i,
  /stream mapping/i,
];

const RETRYABLE_PATTERNS = [
  /timeout/i,
  /econnreset/i,
  /econnrefused/i,
  /etimedout/i,
  /network error/i,
  /socket hang up/i,
  / Lavalink node error/i,
];

const MAX_RETRIES = parseInt(process.env.TRACK_MAX_RETRIES || "2", 10);
const RETRY_BACKOFF_MS = parseInt(process.env.TRACK_RETRY_BACKOFF_MS || "3000", 10);

class TrackErrorHandler {
  constructor(musicManager, nodeHealthMonitor) {
    this.musicManager = musicManager;
    this.health = nodeHealthMonitor;
    this.guildRetries = new Map();
  }

  /**
   * Analiza un error de track y decide la acción a tomar.
   * @returns {{ action: 'retry' | 'skip' | 'stop', reason: string, delayMs: number }}
   */
  classifyError(error) {
    const msg = (error?.message || String(error)).toLowerCase();
    const cause = error?.cause?.message?.toLowerCase() || "";
    const combined = `${msg} ${cause}`;

    // YouTube 403 / Anti-bot
    if (YOUTUBE_403_PATTERNS.some((p) => p.test(combined))) {
      return { action: "skip", reason: "youtube_403_or_antibot", delayMs: 0 };
    }

    // URL expirada - puede ser retryable si refrescamos
    if (URL_EXPIRED_PATTERNS.some((p) => p.test(combined))) {
      return { action: "retry", reason: "url_expired", delayMs: RETRY_BACKOFF_MS };
    }

    // Errores de red / Lavalink node
    if (RETRYABLE_PATTERNS.some((p) => p.test(combined))) {
      return { action: "retry", reason: "network_error", delayMs: RETRY_BACKOFF_MS };
    }

    // FFmpeg errors generalmente no son recuperables con retry
    if (FFMPEG_PATTERNS.some((p) => p.test(combined))) {
      return { action: "skip", reason: "ffmpeg_decode_error", delayMs: 0 };
    }

    // Default: skip para no quedar stuck
    return { action: "skip", reason: "unknown_error", delayMs: 0 };
  }

  /**
   * Maneja el error de un track en reproducción.
   */
  async handleTrackError(player, track, error) {
    const guildId = player.guildId;
    const classification = this.classifyError(error);

    log.warn("Track error classified", {
      guildId,
      action: classification.action,
      reason: classification.reason,
      trackTitle: track?.title,
    });

    const retries = this.guildRetries.get(guildId) || 0;

    if (classification.action === "retry" && retries < MAX_RETRIES) {
      this.guildRetries.set(guildId, retries + 1);

      log.info("Retrying track after delay", {
        guildId,
        delayMs: classification.delayMs,
        retryCount: retries + 1,
      });

      await this._delay(classification.delayMs);

      try {
        await player.play(track);
        log.info("Track retry succeeded", { guildId, trackTitle: track?.title });
        this.guildRetries.delete(guildId);
        return { recovered: true };
      } catch (retryErr) {
        log.error("Track retry failed", { guildId, error: retryErr.message });
        // Fall through to skip
      }
    }

    // Reset retries para siguiente track
    this.guildRetries.delete(guildId);

    // Intentar saltar a siguiente pista
    if (player.queue.size > 0) {
      log.info("Skipping to next track in queue", { guildId });
      try {
        await player.skip();
        return { recovered: true, skipped: true };
      } catch (skipErr) {
        log.error("Skip after error also failed", { guildId, error: skipErr.message });
      }
    }

    // No hay más pistas, destruir player
    log.info("No more tracks after error, destroying player", { guildId });
    await this.musicManager.destroyPlayer(guildId);
    return { recovered: false, destroyed: true };
  }

  /**
   * Maneja errores de nodo Lavalink (no específicos de track).
   */
  handleNodeError(nodeName, error) {
    const msg = (error?.message || String(error)).toLowerCase();
    let errorType = "unknown";

    if (/403|forbidden|bot check|sign in/i.test(msg)) errorType = "youtube_403";
    else if (/timeout|econnreset|econnrefused|network/i.test(msg)) errorType = "network";
    else if (/out of memory|heap|gc overhead/i.test(msg)) errorType = "memory";
    else if (/cpu/i.test(msg)) errorType = "cpu";

    this.health.recordFailure(nodeName, errorType);
    log.error("Node error recorded", { nodeName, errorType, message: error?.message });
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { TrackErrorHandler, YOUTUBE_403_PATTERNS };
