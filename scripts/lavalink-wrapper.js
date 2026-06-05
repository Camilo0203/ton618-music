"use strict";

/**
 * Lavalink Wrapper
 *
 * Lee tokens de YouTube desde .youtube-tokens.json (generado por
 * YouTubeTokenService) y los inyecta como variables de entorno antes
 * de lanzar el proceso Java de Lavalink con proxy residencial.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TOKEN_FILE = path.join(ROOT, ".youtube-tokens.json");
const ENV_LAVA = path.join(ROOT, ".env.lavalink");
const ENV_MAIN = path.join(ROOT, ".env");
const LAVA_JAR = path.join(ROOT, "lavalink", "Lavalink.jar");

// Proxy residencial IPRoyal
const PROXY_HOST = process.env.PROXY_HOST || "89.35.94.72";
const PROXY_PORT = process.env.PROXY_PORT || "12323";
const PROXY_USER = process.env.PROXY_USER || "14a76da825113";
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "f3b13bd96a";

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

const DEFAULT_CONFIG = path.join(ROOT, "lavalink", "application-vps.yml");
const configPath = process.argv[2] || process.env.LAVALINK_CONFIG || DEFAULT_CONFIG;

const tokens = { ...loadTokens(), ...loadEnvFile(ENV_MAIN), ...loadEnvFile(ENV_LAVA) };
const env = { ...process.env, ...tokens };

// JVM proxy flags — todo el tráfico HTTP/HTTPS sale por el proxy residencial
const javaArgs = [
  "-Djava.net.preferIPv4Stack=true",
  `-Dhttp.proxyHost=${PROXY_HOST}`,
  `-Dhttp.proxyPort=${PROXY_PORT}`,
  `-Dhttp.proxyUser=${PROXY_USER}`,
  `-Dhttp.proxyPassword=${PROXY_PASSWORD}`,
  `-Dhttps.proxyHost=${PROXY_HOST}`,
  `-Dhttps.proxyPort=${PROXY_PORT}`,
  `-Dhttps.proxyUser=${PROXY_USER}`,
  `-Dhttps.proxyPassword=${PROXY_PASSWORD}`,
  "-Djava.net.useSystemProxies=false",
  "-Dhttp.nonProxyHosts=localhost|127.*|[::1]",
  `-Dspring.config.additional-location=file:${configPath}`,
  "-jar",
  LAVA_JAR,
];

console.log(`[lavalink-wrapper] Starting Lavalink with proxy ${PROXY_HOST}:${PROXY_PORT}`);
console.log(`[lavalink-wrapper] Config: ${configPath}`);
if (tokens.YOUTUBE_PO_TOKEN) {
  console.log("[lavalink-wrapper] poToken injected");
}
if (tokens.YOUTUBE_VISITOR_DATA) {
  console.log("[lavalink-wrapper] visitorData injected");
}

const child = spawn("java", javaArgs, {
  stdio: "inherit",
  env,
  cwd: ROOT,
});

function killChild() {
  if (child && !child.killed) {
    console.log("[lavalink-wrapper] Killing Lavalink child process...");
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000);
  }
}

process.on("SIGTERM", () => { killChild(); process.exit(0); });
process.on("SIGINT", () => { killChild(); process.exit(0); });

child.on("exit", (code) => {
  console.log(`[lavalink-wrapper] Lavalink exited with code ${code}`);
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("[lavalink-wrapper] Failed to start Lavalink:", err.message);
  process.exit(1);
});
