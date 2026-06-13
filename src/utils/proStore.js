"use strict";

const DEFAULT_PRO_STORE_URL = "https://store.ton618bot.xyz/";

function getProStoreUrl(env = process.env) {
  const configured = String(
    env?.TEBEX_STORE_URL || env?.PRO_UPGRADE_URL || ""
  ).trim();
  if (!configured) return DEFAULT_PRO_STORE_URL;

  try {
    const url = new URL(configured);
    const blockedHosts = new Set(["discord.gg", "discord.com", "www.discord.com"]);
    if (!["http:", "https:"].includes(url.protocol) || blockedHosts.has(url.hostname)) {
      return DEFAULT_PRO_STORE_URL;
    }
    return url.toString();
  } catch {
    return DEFAULT_PRO_STORE_URL;
  }
}

module.exports = { DEFAULT_PRO_STORE_URL, getProStoreUrl };
