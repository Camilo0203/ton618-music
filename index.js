"use strict";

/**
 * TON618 Music Module — Entry Point
 *
 * Este módulo puede correr de dos formas:
 *
 * A) INDEPENDIENTE: como un proceso Node.js separado con su propio cliente Discord.
 *    Útil si quieres separar el proceso de música del bot principal.
 *
 * B) INTEGRADO: importando MusicManager y musicInteractionHandler desde ton618-bot/index.js.
 *    Recomendado para mantener un solo proceso.
 *
 * Por defecto corre en modo INDEPENDIENTE.
 * Ver README.md para instrucciones de integración.
 */

require("dotenv").config();

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { MusicManager } = require("./src/music/MusicManager");
const { musicInteractionHandler } = require("./src/handlers/musicInteractionHandler");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("❌  DISCORD_TOKEN no está configurado en .env");
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

client.once("ready", () => {
  console.log(`[TON618-Music] Conectado como: ${client.user.tag}`);
  console.log(`[TON618-Music] Servidores: ${client.guilds.cache.size}`);

  // Instanciar MusicManager después de que el cliente esté listo
  client.musicManager = new MusicManager(client);
});

client.on("interactionCreate", musicInteractionHandler);

// Reenviar eventos de voz al MusicManager (necesario para Shoukaku)
client.on("raw", (data) => {
  if (["VOICE_SERVER_UPDATE", "VOICE_STATE_UPDATE"].includes(data.t)) {
    if (client.musicManager) {
      client.musicManager.kazagumo.shoukaku.updateVoiceData(data);
    }
  }
});

// Manejo de errores no capturados
process.on("unhandledRejection", (reason) => {
  console.error("[TON618-Music] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[TON618-Music] Uncaught exception:", err);
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`[TON618-Music] Señal recibida: ${signal}. Apagando...`);

  try {
    if (client.musicManager) {
      const playerIds = [...client.musicManager.kazagumo.players.keys()];
      await Promise.all(playerIds.map((id) => client.musicManager.destroyPlayer(id)));
    }
  } catch {}

  client.destroy();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

client.login(TOKEN).catch((err) => {
  console.error("[TON618-Music] Error al hacer login:", err?.message || err);
  process.exit(1);
});

module.exports = { client };
