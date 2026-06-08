/**
 * /search command
 * Searches for songs without playing them
 * User can then select from results to play
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../utils/logger');
const { createSearchResultEmbed } = require('../utils/musicEmbeds');
const { createSearchSelectMenu, createSearchPaginationButtons } = require('../utils/musicComponents');

const log = createLogger('SearchCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for songs (EN: Search | ES: Buscar canciones)')
    .setDescriptionLocalizations({
      es_ES: 'Busca canciones sin reproducirlas',
      'pt-BR': 'Procura músicas sem reproduzi-las',
    })
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Song name or artist (EN: Song name or artist | ES: Nombre de canción o artista)')
        .setDescriptionLocalizations({
          es_ES: 'Nombre de la canción o artista',
          'pt-BR': 'Nome da música ou artista',
        })
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('source')
        .setDescription('Search source (EN: youtube | spotify | ES: youtube | spotify)')
        .setDescriptionLocalizations({
          es_ES: 'Fuente de búsqueda (youtube | spotify)',
          'pt-BR': 'Fonte de busca (youtube | spotify)',
        })
        .setRequired(false)
        .addChoices(
          { name: 'YouTube', value: 'youtube' },
          { name: 'Spotify', value: 'spotify' }
        )
    ),

  async execute(interaction) {
    try {
      // Get options
      const query = interaction.options.getString('query');
      const source = interaction.options.getString('source') || 'youtube';
      
      // Get context from client
      const musicManager = interaction.client?.musicManager;
      const searchCache = interaction.client?.searchCache;
      const language = interaction.locale === 'es' ? 'es' : 'en';

      if (!musicManager || !searchCache) {
        return await interaction.reply({
          content: language === 'es'
            ? '❌ El servicio de música no está disponible'
            : '❌ Music service is not available',
          ephemeral: true,
        });
      }

      const tier = await musicManager.resolveTierForUser(interaction.guild.id, interaction.user.id);

      // Defer reply
      await interaction.deferReply();

      // Check cache first
      let results = searchCache.getCache(query, source);
      let fromCache = false;

      if (!results) {
        // Search if not cached
        try {
          results = await musicManager.search(query, tier, { engine: source });
        } catch (error) {
          log.error('Search error', { query, source, error: error.message });
          return await interaction.editReply({
            embeds: [
              {
                color: 0xff0000,
                title: language === 'es' ? '❌ Error en búsqueda' : '❌ Search Error',
                description: language === 'es' 
                  ? `No se pudo buscar: ${error.message}`
                  : `Failed to search: ${error.message}`,
              },
            ],
          });
        }

        // Cache the results
        searchCache.setCache(query, results, source);
      } else {
        fromCache = true;
      }

      // Validate results
      if (!results || !results.tracks || results.tracks.length === 0) {
        return await interaction.editReply({
          embeds: [
            {
              color: 0xffaa00,
              title: language === 'es' ? '🔍 Sin resultados' : '🔍 No Results',
              description: language === 'es'
                ? `No se encontraron canciones para: **${query}**`
                : `No songs found for: **${query}**`,
            },
          ],
        });
      }

      // Store tracks in session for pagination
      searchCache.setSessionTracks(interaction.user.id, results.tracks);

      // Get first page
      const pagination = searchCache.getPaginatedResults(interaction.user.id, 0);

      // Create response
      const embed = createSearchResultEmbed(pagination.tracks, query, {
        language,
        pageNum: pagination.pageNum,
        totalPages: pagination.totalPages,
        totalTracks: pagination.totalTracks,
        source,
        fromCache,
      });

      const components = [
        createSearchSelectMenu(pagination.tracks, interaction.user.id, { language }),
      ];

      // Add pagination buttons if needed
      if (pagination.totalPages > 1) {
        components.push(
          createSearchPaginationButtons(interaction.user.id, pagination, { language })
        );
      }

      await interaction.editReply({
        embeds: [embed],
        components,
      });

      log.info('Search executed', {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        query,
        source,
        results: results.tracks.length,
        fromCache,
      });
    } catch (error) {
      log.error('Command execution error', { error: error.message, stack: error.stack });
      
      const errorMessage = interaction.locale === 'es' 
        ? '❌ Error ejecutando comando'
        : '❌ Error executing command';

      if (interaction.deferred) {
        await interaction.editReply({
          embeds: [
            {
              color: 0xff0000,
              description: errorMessage,
            },
          ],
        });
      } else {
        await interaction.reply({
          embeds: [
            {
              color: 0xff0000,
              description: errorMessage,
            },
          ],
          ephemeral: true,
        });
      }
    }
  },
  category: 'music',
};
