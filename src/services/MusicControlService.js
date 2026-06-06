"use strict";

const CONTROL_ERROR_CODES = Object.freeze({
  NO_PLAYER: "no_player",
  NO_TRACK: "no_track",
  USER_NOT_IN_VOICE: "user_not_in_voice",
  BOT_DISCONNECTED: "bot_disconnected",
  DIFFERENT_VOICE_CHANNEL: "different_voice_channel",
  QUEUE_EMPTY: "queue_empty",
});

class MusicControlError extends Error {
  constructor(code) {
    super(code);
    this.name = "MusicControlError";
    this.code = code;
  }
}

function voiceChannelId(member) {
  return member?.voice?.channelId || member?.voice?.channel?.id || null;
}

class MusicControlService {
  constructor(musicManager) {
    this.musicManager = musicManager;
  }

  getPlayer(guildId) {
    return this.musicManager?.kazagumo?.players?.get(guildId) || null;
  }

  validateController(interaction, player, options = {}) {
    const requireTrack = options.requireTrack !== false;
    const requireQueue = Boolean(options.requireQueue);

    if (!player) {
      throw new MusicControlError(CONTROL_ERROR_CODES.NO_PLAYER);
    }
    if (requireTrack && !player.queue?.current) {
      throw new MusicControlError(CONTROL_ERROR_CODES.NO_TRACK);
    }

    const cachedMember = interaction.guild?.members?.cache?.get(interaction.user?.id);
    const userVoiceId = voiceChannelId(interaction.member) || voiceChannelId(cachedMember);
    if (!userVoiceId) {
      throw new MusicControlError(CONTROL_ERROR_CODES.USER_NOT_IN_VOICE);
    }

    const playerVoiceId = player.voiceId || null;
    const botMember =
      interaction.guild?.members?.me ||
      interaction.guild?.members?.cache?.get(interaction.client?.user?.id);
    const botVoiceId = voiceChannelId(botMember);
    if (!playerVoiceId || !botVoiceId) {
      throw new MusicControlError(CONTROL_ERROR_CODES.BOT_DISCONNECTED);
    }
    if (userVoiceId !== playerVoiceId || botVoiceId !== playerVoiceId) {
      throw new MusicControlError(CONTROL_ERROR_CODES.DIFFERENT_VOICE_CHANNEL);
    }
    if (requireQueue && (Number(player.queue?.size) || 0) === 0) {
      throw new MusicControlError(CONTROL_ERROR_CODES.QUEUE_EMPTY);
    }

    return true;
  }

  togglePause(player) {
    const paused = !Boolean(player.paused);
    player.pause(paused);
    return paused;
  }

  skipCurrent(player) {
    const skipped = player.queue?.current || null;
    player.skip();
    return skipped;
  }

  stop(guildId) {
    return this.musicManager.destroyPlayer(guildId);
  }

  setLoop(player, mode) {
    player.setLoop(mode);
    return mode;
  }

  toggleLoop(player, tier = "free") {
    const current = player.loop || "none";
    const modes = tier === "pro"
      ? ["none", "track", "queue"]
      : ["none", "track"];
    const currentIndex = modes.indexOf(current);
    const nextMode = modes[(currentIndex + 1) % modes.length] || "none";
    return this.setLoop(player, nextMode);
  }

  shuffleQueue(player) {
    player.queue.shuffle();
    return player.queue.size;
  }

  setVolume(player, volume) {
    return player.setVolume(volume);
  }
}

module.exports = {
  CONTROL_ERROR_CODES,
  MusicControlError,
  MusicControlService,
};
