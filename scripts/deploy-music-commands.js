"use strict";

/**
 * Registra los slash commands del módulo de música en Discord.
 * Uso: node scripts/deploy-music-commands.js
 *
 * Variables requeridas en .env:
 *   DISCORD_TOKEN
 *   DISCORD_CLIENT_ID  (Application ID del bot)
 *   GUILD_ID           (opcional — si se define, registra solo en ese servidor; más rápido en dev)
 */

require("dotenv").config();

const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.error("❌  DISCORD_TOKEN no está configurado en .env");
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error("❌  DISCORD_CLIENT_ID no está configurado en .env");
  process.exit(1);
}

const commandsPath = path.join(__dirname, "..", "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.toJSON) {
    commands.push(command.data.toJSON());
    console.log(`  ✔  ${command.data.name}`);
  }
}

console.log(`\n📦 ${commands.length} comandos de música listos para registrar.\n`);

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      console.log(`🔧 Registrando en servidor: ${GUILD_ID} (instantáneo)`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } else {
      console.log("🌐 Registrando globalmente (puede tardar hasta 1 hora en propagarse)");
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    }
    console.log("✅ Comandos de música registrados correctamente.");
  } catch (err) {
    console.error("❌ Error al registrar comandos:", err?.message || err);
    process.exit(1);
  }
})();
