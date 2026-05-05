"use strict";

/**
 * PremiumResolver — wrapper around @ton618/shared
 *
 * Re-exports resolveGuildTier from the shared package so existing
 * require() sites (commands, MusicManager, etc.) keep working.
 */

const { resolveGuildTier } = require("@ton618/shared");

module.exports = { resolveGuildTier };
