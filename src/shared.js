"use strict";

const TIER_LIMITS = {
  free: {
    maxQueue: 10,
    maxVolume: 80,
    maxDurationSeconds: 300,
    bitrate: 128000,
    lavalinkNode: "free",
    filters: false,
    spotifyEnabled: false,
    playlistEnabled: false,
  },
  pro: {
    maxQueue: 200,
    maxVolume: 100,
    maxDurationSeconds: 21600,
    bitrate: 320000,
    lavalinkNode: "pro",
    filters: true,
    spotifyEnabled: true,
    playlistEnabled: true,
  },
};

function getTierLimitsFromEnv() {
  const readEnv = (key, fallback) => {
    const val = process.env[key];
    return val !== undefined ? parseInt(val, 10) : parseInt(fallback, 10);
  };
  return {
    free: {
      ...TIER_LIMITS.free,
      maxQueue: readEnv("MUSIC_FREE_MAX_QUEUE", "10"),
      maxVolume: readEnv("MUSIC_FREE_MAX_VOLUME", "80"),
      maxDurationSeconds: readEnv("MUSIC_FREE_MAX_DURATION_SECONDS", "300"),
    },
    pro: {
      ...TIER_LIMITS.pro,
      maxQueue: readEnv("MUSIC_PRO_MAX_QUEUE", "200"),
      maxVolume: readEnv("MUSIC_PRO_MAX_VOLUME", "100"),
      maxDurationSeconds: readEnv("MUSIC_PRO_MAX_DURATION_SECONDS", "21600"),
    },
  };
}

let _mongoClient = null;

async function getMongoClient(uri) {
  if (_mongoClient) return _mongoClient;
  const { MongoClient } = await import("mongodb");
  _mongoClient = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 3000 });
  await _mongoClient.connect();
  return _mongoClient;
}

async function resolveGuildTier(guildId, options = {}) {
  if (!guildId) return "free";
  const { mongoUri, dbName = "ton618_bot", supabaseUrl, botApiKey, logger } = options;

  if (mongoUri) {
    try {
      const client = await getMongoClient(mongoUri);
      const doc = await client.db(dbName).collection("premium_cache").findOne({
        guild_id: guildId,
        app_cache_expires_at: { $gt: new Date() },
      });
      if (doc) return doc.has_premium === true ? "pro" : "free";
    } catch (err) {
      logger?.error?.(`[premium] Mongo error: ${err.message}`);
    }
  }

  if (supabaseUrl && botApiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${supabaseUrl}/functions/v1/billing-guild-status/${guildId}`, {
        headers: { "X-Bot-Api-Key": botApiKey, "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.has_premium === true ? "pro" : "free";
    } catch (err) {
      logger?.error?.(`[premium] Supabase error: ${err.message}`);
    }
  }

  return "free";
}

function closePremiumResolver() {
  if (_mongoClient) {
    _mongoClient.close().catch(() => {});
    _mongoClient = null;
  }
}

module.exports = { TIER_LIMITS, getTierLimitsFromEnv, resolveGuildTier, closePremiumResolver };
