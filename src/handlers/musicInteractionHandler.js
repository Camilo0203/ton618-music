"use strict";

/**
 * musicInteractionHandler
 *
 * Router central de interacciones para los comandos de música.
 * Se registra en el evento interactionCreate del cliente Discord.
 *
 * Uso en index.js del módulo música:
 *   client.on('interactionCreate', musicInteractionHandler);
 */

const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");

const commands = new Collection();

/** Carga todos los comandos de la carpeta src/commands */
function loadCommands() {
  const commandsPath = path.join(__dirname, "..", "commands");
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (command?.data?.name) {
      commands.set(command.data.name, command);
    }
  }

  console.log(`[MusicHandler] Loaded ${commands.size} music commands`);
}

loadCommands();

async function musicInteractionHandler(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  // Solo procesar comandos de categoría "music"
  if (command.category !== "music") return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[MusicHandler] Error executing /${interaction.commandName}:`, error?.message || error);

    const payload = {
      content: "❌ Ocurrió un error al ejecutar el comando de música. Inténtalo de nuevo.",
      ephemeral: true,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch {
      // Silenciar errores de respuesta si la interacción ya expiró
    }
  }
}

module.exports = { musicInteractionHandler, commands };
