"use strict";

const os = require("os");
const { createLogger } = require("./logger");

const log = createLogger("InteractionResponses");

function isAlreadyAcknowledgedError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return error?.code === 40060 || message.includes("already been acknowledged") || message.includes("interactionalreadyreplied");
}

function isNotAcknowledgedError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return error?.code === 40001 || error?.code === 10062 || message.includes("not been sent or deferred") || message.includes("unknown interaction");
}

function logContext(interaction) {
  return {
    pid: process.pid,
    hostname: os.hostname(),
    interactionId: interaction?.id || null,
    commandName: interaction?.commandName || null,
    guildId: interaction?.guildId || null,
    userId: interaction?.user?.id || null,
    deferred: Boolean(interaction?.deferred),
    replied: Boolean(interaction?.replied),
  };
}

async function ensureDeferred(interaction, options) {
  if (!interaction || interaction.deferred || interaction.replied) {
    return true;
  }

  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    if (isAlreadyAcknowledgedError(error)) {
      interaction.__ton618AcknowledgedElsewhere = true;
      log.warn("Interaction was already acknowledged before defer", {
        ...logContext(interaction),
        error: error?.message || String(error),
        code: error?.code || null,
      });
      return false;
    }

    log.error("Failed to defer interaction", {
      ...logContext(interaction),
      error: error?.message || String(error),
      code: error?.code || null,
      stack: error?.stack,
    });
    throw error;
  }
}

async function safeRespond(interaction, payload) {
  if (!interaction) return null;

  const methods = interaction.deferred || interaction.replied || interaction.__ton618AcknowledgedElsewhere
    ? ["editReply", "followUp"]
    : ["reply", "editReply", "followUp"];

  let lastError = null;
  for (const method of methods) {
    if (typeof interaction[method] !== "function") continue;
    try {
      return await interaction[method](payload);
    } catch (error) {
      lastError = error;
      if (isAlreadyAcknowledgedError(error) || isNotAcknowledgedError(error)) {
        continue;
      }
      log.warn("Interaction response method failed", {
        ...logContext(interaction),
        method,
        error: error?.message || String(error),
        code: error?.code || null,
      });
    }
  }

  if (lastError) {
    log.warn("All interaction response methods failed", {
      ...logContext(interaction),
      error: lastError?.message || String(lastError),
      code: lastError?.code || null,
    });
  }

  return null;
}

module.exports = {
  ensureDeferred,
  safeRespond,
  isAlreadyAcknowledgedError,
};
