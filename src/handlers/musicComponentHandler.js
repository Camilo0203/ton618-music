"use strict";

const { resolveGuildTier } = require("../utils/premiumResolver");
const { TIER_LIMITS, TIMEOUTS } = require("../config/lavalinkConfig");
const {
  createMusicErrorEmbed,
  createMusicSuccessEmbed,
  createMusicWarningEmbed,
  createNowPlayingEmbed,
  createQueueEmbed,
  proOnlyEmbed,
} = require("../utils/musicEmbeds");
const {
  MUSIC_CONTROL_IDS,
  createPlayerControls,
  createQueuePaginationControls,
  isMusicControlId,
} = require("../utils/musicComponents");
const {
  QUEUE_ACTIONS,
  QUEUE_CUSTOM_ID_PREFIX,
  createQueueSessionId,
  getQueuePagination,
  getQueueTrackCount,
  isQueueSessionCurrent,
  parseQueueCustomId,
} = require("../utils/musicQueuePagination");
const {
  CONTROL_ERROR_CODES,
  MusicControlError,
  MusicControlService,
} = require("../services/MusicControlService");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");

const log = createLogger("MusicComponentHandler");
const UPGRADE_URL = process.env.PRO_UPGRADE_URL || "https://ton618.app/pricing";
const controlLocks = new Map();

const ALLOWED_GUILD_IDS = new Set(
  (process.env.MUSIC_ALLOWED_GUILD_ID || process.env.MUSIC_ALLOWED_GUILD_IDS || "")
    .split(",")
    .map((guildId) => guildId.trim())
    .filter(Boolean)
);

function isMusicComponent(interaction) {
  return Boolean(
    interaction?.isButton?.() &&
    typeof interaction.customId === "string" &&
    interaction.customId.startsWith("music:")
  );
}

async function acknowledgeButton(interaction) {
  if (interaction.deferred || interaction.replied) return false;
  try {
    await interaction.deferUpdate();
    return true;
  } catch (error) {
    log.warn("Failed to acknowledge music control", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      code: error?.code || null,
      error: error?.message || String(error),
    });
    return false;
  }
}

async function followUpEphemeral(interaction, embed, components = []) {
  try {
    await interaction.followUp({ embeds: [embed], components, flags: 64 });
  } catch (error) {
    log.warn("Failed to send music control follow-up", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      code: error?.code || null,
      error: error?.message || String(error),
    });
  }
}

async function editControlMessage(interaction, payload) {
  try {
    await interaction.editReply(payload);
    return true;
  } catch (error) {
    log.warn("Failed to update music control message", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      code: error?.code || null,
      error: error?.message || String(error),
    });
    return false;
  }
}

async function resolveTierSafely(guildId) {
  let timeout = null;
  try {
    return await Promise.race([
      resolveGuildTier(guildId),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("tier_timeout")),
          Math.max(500, Number(TIMEOUTS.tierResolve) || 3000)
        );
      }),
    ]);
  } catch (error) {
    log.warn("Tier resolution failed for music control", {
      guildId,
      error: error?.message || String(error),
    });
    return "free";
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function controlErrorMessage(code, language) {
  switch (code) {
    case CONTROL_ERROR_CODES.USER_NOT_IN_VOICE:
      return t(language, "control_voice_required");
    case CONTROL_ERROR_CODES.BOT_DISCONNECTED:
      return t(language, "control_bot_disconnected");
    case CONTROL_ERROR_CODES.DIFFERENT_VOICE_CHANNEL:
      return t(language, "control_same_voice_required");
    case CONTROL_ERROR_CODES.QUEUE_EMPTY:
      return t(language, "control_queue_empty");
    case CONTROL_ERROR_CODES.NO_PLAYER:
    case CONTROL_ERROR_CODES.NO_TRACK:
    default:
      return t(language, "nowplaying_nothing");
  }
}

async function withGuildControlLock(guildId, task) {
  if (controlLocks.has(guildId)) return false;
  controlLocks.set(guildId, true);

  try {
    await task();
    return true;
  } finally {
    controlLocks.delete(guildId);
  }
}

async function runControl(interaction, language) {
  if (!isMusicControlId(interaction.customId)) {
    await followUpEphemeral(
      interaction,
      createMusicWarningEmbed(t(language, "control_unknown"), null, language)
    );
    return;
  }

  if (ALLOWED_GUILD_IDS.size > 0 && !ALLOWED_GUILD_IDS.has(interaction.guildId)) {
    await followUpEphemeral(
      interaction,
      createMusicErrorEmbed(t(language, "control_unavailable_guild"), language)
    );
    return;
  }

  const musicManager = interaction.client?.musicManager;
  if (!musicManager) {
    await followUpEphemeral(
      interaction,
      createMusicErrorEmbed(t(language, "error_lavalink"), language)
    );
    return;
  }

  const service = new MusicControlService(musicManager);
  const player = service.getPlayer(interaction.guildId);
  const requireQueue = interaction.customId === MUSIC_CONTROL_IDS.SHUFFLE;

  try {
    service.validateController(interaction, player, { requireQueue });
  } catch (error) {
    if (error instanceof MusicControlError) {
      await followUpEphemeral(
        interaction,
        createMusicErrorEmbed(controlErrorMessage(error.code, language), language)
      );
      return;
    }
    throw error;
  }

  const tier = await resolveTierSafely(interaction.guildId);

  switch (interaction.customId) {
    case MUSIC_CONTROL_IDS.PAUSE: {
      service.togglePause(player);
      await editControlMessage(interaction, {
        embeds: [createNowPlayingEmbed(player.queue.current, player, tier, language)],
        components: createPlayerControls(player, tier, language),
      });
      break;
    }

    case MUSIC_CONTROL_IDS.SKIP: {
      const skipped = service.skipCurrent(player);
      const hasNext = player.queue.size > 0 || player.loop === "track" || player.loop === "queue";
      await editControlMessage(interaction, {
        embeds: [
          createMusicSuccessEmbed(
            t(language, "skip_single"),
            t(language, "skip_single_desc", {
              title: skipped?.title || t(language, "unknown"),
            }),
            { language }
          ),
        ],
        components: createPlayerControls(player, tier, language, { disabled: !hasNext }),
      });
      break;
    }

    case MUSIC_CONTROL_IDS.STOP:
      await service.stop(interaction.guildId);
      await editControlMessage(interaction, {
        embeds: [
          createMusicSuccessEmbed(
            t(language, "stop_stopped"),
            t(language, "stop_stopped_desc"),
            { language }
          ),
        ],
        components: createPlayerControls(null, tier, language, { disabled: true }),
      });
      break;

    case MUSIC_CONTROL_IDS.LOOP:
      service.toggleLoop(player, tier);
      await editControlMessage(interaction, {
        embeds: [createNowPlayingEmbed(player.queue.current, player, tier, language)],
        components: createPlayerControls(player, tier, language),
      });
      break;

    case MUSIC_CONTROL_IDS.SHUFFLE:
      if (tier !== "pro") {
        await followUpEphemeral(
          interaction,
          proOnlyEmbed(t(language, "shuffle_pro_only"), UPGRADE_URL, language)
        );
        return;
      }
      service.shuffleQueue(player);
      await editControlMessage(interaction, {
        embeds: [createNowPlayingEmbed(player.queue.current, player, tier, language)],
        components: createPlayerControls(player, tier, language),
      });
      await followUpEphemeral(
        interaction,
        createMusicSuccessEmbed(
          t(language, "shuffle_done"),
          t(language, "shuffle_done_desc", { count: player.queue.size }),
          { tier, language }
        )
      );
      break;

    case MUSIC_CONTROL_IDS.QUEUE: {
      const pagination = getQueuePagination(getQueueTrackCount(player.queue), 1);
      const sessionId = createQueueSessionId(player);
      await followUpEphemeral(
        interaction,
        createQueueEmbed(player, tier, pagination.page, language),
        createQueuePaginationControls({
          ownerId: interaction.user.id,
          sessionId,
          page: pagination.page,
          totalItems: pagination.totalItems,
          language,
        })
      );
      break;
    }

    case MUSIC_CONTROL_IDS.VOLUME: {
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      await followUpEphemeral(
        interaction,
        createMusicWarningEmbed(
          t(language, "control_volume_hint", { max: limits.maxVolume }),
          tier,
          language
        )
      );
      break;
    }
  }
}

async function runQueuePagination(interaction, language) {
  const parsed = parseQueueCustomId(interaction.customId);
  if (!parsed) {
    await followUpEphemeral(
      interaction,
      createMusicWarningEmbed(t(language, "control_unknown"), null, language)
    );
    return;
  }

  if (ALLOWED_GUILD_IDS.size > 0 && !ALLOWED_GUILD_IDS.has(interaction.guildId)) {
    await followUpEphemeral(
      interaction,
      createMusicErrorEmbed(t(language, "control_unavailable_guild"), language)
    );
    return;
  }

  const musicManager = interaction.client?.musicManager;
  if (!musicManager) {
    await followUpEphemeral(
      interaction,
      createMusicErrorEmbed(t(language, "error_lavalink"), language)
    );
    return;
  }
  const service = new MusicControlService(musicManager);
  const player = service.getPlayer(interaction.guildId);

  try {
    service.validateQueueController(interaction, player, parsed.ownerId);
  } catch (error) {
    if (error instanceof MusicControlError) {
      await followUpEphemeral(
        interaction,
        createMusicErrorEmbed(t(language, "queue_not_authorized"), language)
      );
      return;
    }
    throw error;
  }

  if (parsed.action === QUEUE_ACTIONS.CLOSE) {
    await editControlMessage(interaction, { components: [] });
    return;
  }

  if (!player || !isQueueSessionCurrent(player, parsed.sessionId)) {
    await editControlMessage(interaction, {
      embeds: [
        createMusicWarningEmbed(
          t(language, "queue_session_expired"),
          null,
          language
        ),
      ],
      components: [],
    });
    return;
  }

  const tier = await resolveTierSafely(interaction.guildId);
  const pagination = getQueuePagination(
    getQueueTrackCount(player.queue),
    parsed.page
  );

  await editControlMessage(interaction, {
    embeds: [createQueueEmbed(player, tier, pagination.page, language)],
    components: createQueuePaginationControls({
      ownerId: parsed.ownerId,
      sessionId: parsed.sessionId,
      page: pagination.page,
      totalItems: pagination.totalItems,
      language,
    }),
  });
}

async function musicComponentHandler(interaction) {
  if (!isMusicComponent(interaction)) return false;
  if (!(await acknowledgeButton(interaction))) return true;

  const language = normalizeLanguage(interaction.locale || interaction.guildLocale, "en");

  try {
    const task = interaction.customId.startsWith(`${QUEUE_CUSTOM_ID_PREFIX}:`)
      ? runQueuePagination
      : runControl;
    const handled = await withGuildControlLock(interaction.guildId || "dm", () =>
      task(interaction, language)
    );
    if (!handled) {
      await followUpEphemeral(
        interaction,
        createMusicWarningEmbed(t(language, "control_busy"), null, language)
      );
    }
  } catch (error) {
    log.error("Music control failed", {
      customId: interaction.customId,
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      error: error?.message || String(error),
      stack: error?.stack,
    });
    await followUpEphemeral(
      interaction,
      createMusicErrorEmbed(t(language, "error_generic"), language)
    );
  }

  return true;
}

module.exports = {
  isMusicComponent,
  musicComponentHandler,
};
