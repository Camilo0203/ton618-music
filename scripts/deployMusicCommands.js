"use strict";

/**
 * Despliega los slash commands de música a Discord
 *
 * Uso:
 *   node scripts/deployMusicCommands.js
 *   node scripts/deployMusicCommands.js --guild <GUILD_ID>   (solo ese servidor)
 */

require("dotenv").config();

const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌  DISCORD_TOKEN y DISCORD_CLIENT_ID son requeridos en .env");
  process.exit(1);
}

const guildArg = process.argv.indexOf("--guild");
const GUILD_ID = guildArg !== -1 ? process.argv[guildArg + 1] : null;

const commandsPath = path.join(__dirname, "..", "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

const commandsData = [];
for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd?.data) {
    commandsData.push(cmd.data.toJSON());
    console.log(`  ✓ ${cmd.data.name}`);
  }
}

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log(`\nDeployando ${commandsData.length} comandos de música...`);

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commandsData,
      });
      console.log(`✅ Comandos deployados en guild: ${GUILD_ID}`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commandsData,
      });
      console.log("✅ Comandos deployados globalmente (puede tardar hasta 1h en propagarse)");
    }
  } catch (err) {
    console.error("❌ Error deploying commands:", err?.message || err);
    process.exit(1);
  }
})();
