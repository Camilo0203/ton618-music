"use strict";

/**
 * PremiumResolver
 *
 * Lee el estado premium de un guild desde MongoDB (cache local del bot) o,
 * si no está disponible, consulta la Supabase Edge Function billing-guild-status.
 *
 * Retorna "pro" | "free"
 */

const https = require("https");
const http = require("http");

let _mongoClient = null;
let _db = null;

async function getMongoDb() {
  if (_db) return _db;

  const { MongoClient } = require("mongodb");
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || "ton618_bot";

  if (!uri) return null;

  try {
    if (!_mongoClient) {
      _mongoClient = new MongoClient(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 3000,
      });
      await _mongoClient.connect();
    }
    _db = _mongoClient.db(dbName);
    return _db;
  } catch {
    return null;
  }
}

/**
 * Consulta el caché premium de MongoDB (colección premium_cache)
 * que el bot principal mantiene actualizada.
 */
async function checkMongoCache(guildId) {
  try {
    const db = await getMongoDb();
    if (!db) return null;

    const doc = await db.collection("premium_cache").findOne({
      guild_id: guildId,
      app_cache_expires_at: { $gt: new Date() },
    });

    if (!doc) return null;
    return doc.has_premium === true ? "pro" : "free";
  } catch {
    return null;
  }
}

/**
 * Consulta la edge function billing-guild-status (fuente de verdad)
 */
async function checkSupabaseApi(guildId) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const botApiKey = process.env.BOT_API_KEY;

  if (!supabaseUrl || !botApiKey) return null;

  const url = new URL(`${supabaseUrl}/functions/v1/billing-guild-status/${guildId}`);
  const lib = url.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "X-Bot-Api-Key": botApiKey,
        "Content-Type": "application/json",
      },
      timeout: 4000,
    };

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve(data.has_premium === true ? "pro" : "free");
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Resuelve el tier de un guild: "pro" | "free"
 * Estrategia: MongoDB cache → Supabase API → fallback "free"
 */
async function resolveGuildTier(guildId) {
  if (!guildId) return "free";

  const cached = await checkMongoCache(guildId);
  if (cached !== null) return cached;

  const api = await checkSupabaseApi(guildId);
  if (api !== null) return api;

  return "free";
}

module.exports = { resolveGuildTier };
