"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { resolveGuildTier } = require("../utils/premiumResolver");
const { TIER_LIMITS } = require("../config/lavalinkConfig");
const {
  createMusicErrorEmbed,
  createSearchResultEmbed,
} = require("../utils/musicEmbeds");
const {
  createSearchSelectMenu,
  createSearchPaginationButtons,
} = require("../utils/musicComponents");
const { t, normalizeLanguage } = require("../utils/i18n");
const { createLogger } = require("../utils/logger");
const { ensureDeferred, safeRespond } = require("../utils/interactionResponses");

const log = createLogger("SearchCommand");

const data = new SlashCommandBuilder()
  .setName("search")
  .setDescription("Busca canciones sin reproducirlas")
  .setDescriptionLocalizations({
    "en-US": "Search for songs without playing them",
    "en-GB": "Search for songs without playing them",
    "es-ES": "Busca canciones sin reproducirlas",
    "es-419": "Busca canciones sin reproducirlas",
  })
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Nombre de la canción o artista")
      .setDescriptionLocalizations({
        "en-US": "Song or artist name",
        "en-GB": "Song or artist name",
        "es-ES": "Nombre de la canción o artista",
        "es-419": "Nombre de la canción o artista",
      })
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("source")
      .setDescription("Fuente de búsqueda (YouTube o Spotify)")
      .setDescriptionLocalizations({
        "en-US": "Search source (YouTube or Spotify)",
        "en-GB": "Search source (YouTube or Spotify)",
        "es-ES": "Fuente de búsqueda (YouTube o Spotify)",
        "es-419": "Fuente de búsqueda (YouTube o Spotify)",
      })
      .setRequired(false)
      .addChoices(
        { name: "YouTube", value: "youtube" },
        { name: "Spotify", value: "spotify" }
      )
  );

module.exports = {
  data,
  category: "music",

  async execute(interaction) {
    if (!(await ensureDeferred(interaction))) return;

    const language = normalizeLanguage(interaction.locale || interaction.guildLocale);
    const query = interaction.options.getString("query");
    const source = interaction.options.getString("source") || "youtube";
    const musicManager = interaction.client?.musicManager;
    const searchCache = interaction.client?.searchCache;

    if (!musicManager || !searchCache) {
      log.error("musicManager or searchCache not available", {
        guildId: interaction.guildId,
      });
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "error_lavalink"), language)],
      });
    }

    const tier = await resolveGuildTier(interaction.guildId);
    if (source === "spotify" && tier !== "pro") {
      return safeRespond(interaction, {
        embeds: [createMusicErrorEmbed(t(language, "spotify_pro_only"), language)],
      });
    }

    let results = searchCache.getCache(query, source);
    let fromCache = false;

    if (!results) {
      try {
        const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
        results = await musicManager.search(query, tier);
        if (limits.maxDurationSeconds && Array.isArray(results?.tracks)) {
          results.tracks = results.tracks.filter(
            (track) => !track.length || track.length / 1000 <= limits.maxDurationSeconds
          );
        }
        searchCache.setCache(query, results, source);
      } catch (error) {
        log.error("Search error", {
          guildId: interaction.guildId,
          source,
          error: error?.message || String(error),
        });
        return safeRespond(interaction, {
          embeds: [createMusicErrorEmbed(t(language, "error_search"), language)],
        });
      }
    } else {
      fromCache = true;
    }

    if (!results?.tracks?.length) {
      return safeRespond(interaction, {
        embeds: [
          createMusicErrorEmbed(
            t(language, "error_no_results", { query }),
            language
          ),
        ],
      });
    }

    searchCache.setSessionTracks(interaction.user.id, results.tracks);
    const pagination = searchCache.getPaginatedResults(interaction.user.id, 0);
    const components = [
      createSearchSelectMenu(pagination.tracks, interaction.user.id, { language }),
    ];

    if (pagination.totalPages > 1) {
      components.push(
        createSearchPaginationButtons(interaction.user.id, pagination, { language })
      );
    }

    log.info("Search executed", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      source,
      results: results.tracks.length,
      fromCache,
    });

    return safeRespond(interaction, {
      embeds: [
        createSearchResultEmbed(pagination.tracks, query, {
          language,
          pageNum: pagination.pageNum,
          totalPages: pagination.totalPages,
          totalTracks: pagination.totalTracks,
          source,
          fromCache,
        }),
      ],
      components,
    });
  },
};
