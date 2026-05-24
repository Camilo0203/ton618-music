"use strict";

/**
 * musicInteractionHandler
 *
 * Router central de interacciones con:
 *  - Rate limiting por usuario (prevenir spam)
 *  - Rate limiting por guild (prevenir abuso)
 *  - Logging estructurado de cada comando
 *  - Manejo de interacciones expiradas
 *  - Error recovery y respuestas amigables
 */

const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const { createLogger } = require("../utils/logger");

const log = createLogger("InteractionHandler");

const commands = new Collection();

// Rate limiting simple en memoria
const userCooldowns = new Map();
const guildCooldowns = new Map();
const COOLDOWN_MS = parseInt(process.env.COMMAND_COOLDOWN_MS || "1500", 10);
const GUILD_COOLDOWN_MS = parseInt(process.env.GUILD_COMMAND_COOLDOWN_MS || "800", 10);

function loadCommands() {
  const commandsPath = path.join(__dirname, "..", "commands");
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    try {
      const command = require(path.join(commandsPath, file));
      if (command?.data?.name) {
        commands.set(command.data.name, command);
      }
    } catch (err) {
      log.error("Failed to load command", { file, error: err.message });
    }
  }

  log.info(`Loaded ${commands.size} music commands`);
}

loadCommands();

function isOnCooldown(map, key, durationMs) {
  const last = map.get(key);
  if (!last) return false;
  return Date.now() - last < durationMs;
}

async function musicInteractionHandler(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;
  if (command.category !== "music") return;

  const userKey = `${interaction.user.id}:${interaction.commandName}`;
  const guildKey = `${interaction.guildId}:${interaction.commandName}`;

  // Rate limit por usuario
  if (isOnCooldown(userCooldowns, userKey, COOLDOWN_MS)) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - userCooldowns.get(userKey))) / 1000);
    return safeReply(interaction, {
      content: `⏳ Please wait ${remaining}s before using this command again.`,
      ephemeral: true,
    });
  }

  // Rate limit por guild (global para evitar flood)
  if (isOnCooldown(guildCooldowns, guildKey, GUILD_COOLDOWN_MS)) {
    return safeReply(interaction, {
      content: "⏳ This server is processing a music command. Please wait a moment.",
      ephemeral: true,
    });
  }

  userCooldowns.set(userKey, Date.now());
  guildCooldowns.set(guildKey, Date.now());

  // Cleanup de cooldowns antiguos (cada ~100 interacciones)
  if (userCooldowns.size > 500) {
    const now = Date.now();
    for (const [k, v] of userCooldowns) {
      if (now - v > COOLDOWN_MS * 5) userCooldowns.delete(k);
    }
  }

  const startTime = Date.now();
  const context = {
    command: interaction.commandName,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  };

  try {
    await command.execute(interaction);
    log.info("Command executed", { ...context, durationMs: Date.now() - startTime });
  } catch (error) {
    log.error("Command execution failed", {
      ...context,
      error: error?.message || String(error),
      stack: error?.stack,
      durationMs: Date.now() - startTime,
    });

    const payload = {
      content: "❌ An error occurred while executing the music command. Please try again later.",
      ephemeral: true,
    };

    await safeReply(interaction, payload);
  }
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (replyErr) {
    log.warn("Failed to reply to interaction", {
      command: interaction.commandName,
      error: replyErr.message,
    });
  }
}

module.exports = { musicInteractionHandler, commands };
