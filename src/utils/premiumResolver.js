"use strict";

/**
 * PremiumResolver — wrapper around @ton618/shared
 *
 * Passes environment-based options so premium lookups actually
 * hit MongoDB (or Supabase). Without options, resolveGuildTier
 * has no data source and always returns "free".
 */

const { resolveGuildTier: _resolveGuildTier } = require("../shared");

const RESOLVER_OPTIONS = {
  mongoUri: process.env.MONGO_URI,
  dbName: process.env.MONGO_DB || "ton618_bot",
  supabaseUrl: process.env.SUPABASE_URL,
  botApiKey: process.env.BOT_API_KEY,
};

function resolveGuildTier(guildId) {
  return _resolveGuildTier(guildId, RESOLVER_OPTIONS);
}

module.exports = { resolveGuildTier };
