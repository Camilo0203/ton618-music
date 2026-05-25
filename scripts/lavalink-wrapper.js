"use strict";

/**
 * Lavalink Wrapper
 *
 * Lee tokens de YouTube desde .youtube-tokens.json (generado por
 * YouTubeTokenService) y los inyecta como variables de entorno antes
 * de lanzar el proceso Java de Lavalink.
 *
 * Uso:
 *   node scripts/lavalink-wrapper.js <path/to/application.yml>
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TOKEN_FILE = path.join(ROOT, ".youtube-tokens.json");
const ENV_LAVA = path.join(ROOT, ".env.lavalink");
const LAVA_JAR = path.join(ROOT, "lavalink", "Lavalink.jar");

function loadEnvFile(filePath) {
  const env = {};
  try {
    if (!fs.existsSync(filePath)) return env;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const eq = line.indexOf("=");
      if (eq > 0) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim();
        if (key) env[key] = val;
      }
    }
  } catch (err) {
    console.error("[lavalink-wrapper] Failed to load .env.lavalink:", err.message);
  }
  return env;
}

function loadTokens() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return {};
    const raw = fs.readFileSync(TOKEN_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      YOUTUBE_PO_TOKEN: data.poToken || "",
      YOUTUBE_VISITOR_DATA: data.visitorData || "",
    };
  } catch (err) {
    console.error("[lavalink-wrapper] Failed to load tokens:", err.message);
    return {};
  }
}

const configPath = process.argv[2];
if (!configPath) {
  console.error("[lavalink-wrapper] Usage: node lavalink-wrapper.js <application.yml>");
  process.exit(1);
}

const tokens = { ...loadTokens(), ...loadEnvFile(ENV_LAVA) };
const env = { ...process.env, ...tokens };

console.log(`[lavalink-wrapper] Starting Lavalink with config: ${configPath}`);
if (tokens.YOUTUBE_PO_TOKEN) {
  console.log("[lavalink-wrapper] poToken injected");
}
if (tokens.YOUTUBE_VISITOR_DATA) {
  console.log("[lavalink-wrapper] visitorData injected");
}

const child = spawn("java", ["-Dconfig.file=" + configPath, "-jar", LAVA_JAR], {
  stdio: "inherit",
  env,
  cwd: ROOT,
});

child.on("exit", (code) => {
  console.log(`[lavalink-wrapper] Lavalink exited with code ${code}`);
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("[lavalink-wrapper] Failed to start Lavalink:", err.message);
  process.exit(1);
});
