/**
 * Music Search Handler
 * Handles search menu selections and pagination
 */

const { createLogger } = require('../utils/logger');
const { createSearchResultEmbed } = require('../utils/musicEmbeds');
const { createSearchSelectMenu, createSearchPaginationButtons, SEARCH_ACTIONS } = require('../utils/musicComponents');

const log = createLogger('MusicSearchHandler');

// Track active searches with timeouts
const activeSessions = new Map();

/**
 * Add session and auto-cleanup after timeout
 */
function addSessionTimeout(userId, timeoutMs = 300000) {
  // Clear existing timeout
  if (activeSessions.has(userId)) {
    const timeout = activeSessions.get(userId);
    if (timeout) clearTimeout(timeout);
  }

  // Set new timeout
  const timeoutId = setTimeout(() => {
    activeSessions.delete(userId);
    log.debug('Session timeout for user', { userId });
  }, timeoutMs);

  activeSessions.set(userId, timeoutId);
}

/**
 * Handle search select menu interactions
 */
async function handleSearchSelect(interaction, { searchCache, musicManager, language = 'en' }) {
  try {
    const userId = interaction.user.id;
    const [trackIndex] = interaction.values;
    const index = parseInt(trackIndex, 10);

    // Get track from session
    const track = searchCache.getTrackByIndex(userId, index);
    
    if (!track) {
      return await interaction.reply({
        embeds: [{
          color: 0xff0000,
          description: language === 'es'
            ? '❌ Canción no encontrada'
            : '❌ Song not found',
        }],
        ephemeral: true,
      });
    }

    // Defer reply
    await interaction.deferReply();

    // Create/get player
    let player = musicManager.players.get(interaction.guild.id);
    if (!player) {
      player = musicManager.create({
        guild: interaction.guild.id,
        textChannel: interaction.channel.id,
        voiceChannel: interaction.member?.voice?.channelId,
      });
    }

    // Enqueue track
    player.queue.add(track);
    
    // Auto-play if not playing
    if (!player.playing && !player.paused) {
      await player.play();
    }

    // Create response
    const embed = {
      color: 0x57f287,
      title: language === 'es' ? '✅ Añadido a la cola' : '✅ Added to Queue',
      description: `**${track.title}**\n👤 ${track.author || 'Unknown'}`,
      footer: {
        text: language === 'es' 
          ? `Posición en la cola: ${player.queue.size}`
          : `Queue position: ${player.queue.size}`,
      },
    };

    await interaction.editReply({
      embeds: [embed],
      components: [],
    });

    // Reset session timeout
    addSessionTimeout(userId);

    log.info('Track selected and queued', {
      userId,
      guildId: interaction.guild.id,
      trackTitle: track.title,
      queuePosition: player.queue.size,
    });
  } catch (error) {
    log.error('Error handling search select', { error: error.message, stack: error.stack });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [{
          color: 0xff0000,
          description: language === 'es'
            ? '❌ Error al procesar la selección'
            : '❌ Error processing selection',
        }],
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        embeds: [{
          color: 0xff0000,
          description: language === 'es'
            ? '❌ Error al procesar la selección'
            : '❌ Error processing selection',
        }],
      });
    }
  }
}

/**
 * Handle search pagination
 */
async function handleSearchPagination(interaction, { searchCache, language = 'en' }) {
  try {
    const userId = interaction.user.id;
    const [, action, pageStr] = interaction.customId.split(':').slice(2);
    const newPage = action === SEARCH_ACTIONS.CLOSE ? null : parseInt(pageStr, 10);

    // Defer update
    await interaction.deferUpdate();

    // Handle close action
    if (action === SEARCH_ACTIONS.CLOSE) {
      searchCache.clearSession(userId);
      await interaction.editReply({
        content: language === 'es' ? 'Búsqueda cerrada' : 'Search closed',
        embeds: [],
        components: [],
      });
      return;
    }

    // Get paginated results
    const pagination = searchCache.getPaginatedResults(userId, newPage);

    if (!pagination) {
      await interaction.editReply({
        embeds: [{
          color: 0xffaa00,
          description: language === 'es'
            ? '❌ Página no válida'
            : '❌ Invalid page',
        }],
      });
      return;
    }

    // Update current page in cache
    searchCache.setCurrentPage(userId, newPage);

    // Get original query from tracks (estimate)
    const tracks = searchCache.getSessionTracks(userId);
    const query = `${pagination.totalTracks} ${language === 'es' ? 'resultados' : 'results'}`;

    // Create updated embed
    const embed = createSearchResultEmbed(pagination.tracks, query, {
      language,
      pageNum: newPage,
      totalPages: pagination.totalPages,
      totalTracks: pagination.totalTracks,
    });

    // Create components
    const components = [
      createSearchSelectMenu(pagination.tracks, userId, { language }),
    ];

    if (pagination.totalPages > 1) {
      components.push(
        createSearchPaginationButtons(userId, pagination, { language })
      );
    }

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    // Reset session timeout
    addSessionTimeout(userId);

    log.debug('Pagination updated', {
      userId,
      guildId: interaction.guild.id,
      page: newPage,
      totalPages: pagination.totalPages,
    });
  } catch (error) {
    log.error('Error handling search pagination', { error: error.message });

    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [{
          color: 0xff0000,
          description: language === 'es'
            ? '❌ Error en la paginación'
            : '❌ Pagination error',
        }],
      });
    }
  }
}

/**
 * Route search interactions
 */
async function handleSearchInteraction(interaction, context) {
  const customId = interaction.customId;

  try {
    // Select menu: music:search:select:userId
    if (customId.includes('music:search:select:')) {
      return await handleSearchSelect(interaction, context);
    }

    // Pagination: music:search:pagination:userId:action:page
    if (customId.includes('music:search:pagination:')) {
      return await handleSearchPagination(interaction, context);
    }
  } catch (error) {
    log.error('Error routing search interaction', { error: error.message });
  }
}

/**
 * Check if interaction is search-related
 */
function isSearchInteraction(customId) {
  return customId && customId.startsWith('music:search:');
}

/**
 * Clean all sessions
 */
function cleanupAllSessions() {
  for (const timeout of activeSessions.values()) {
    if (timeout) clearTimeout(timeout);
  }
  activeSessions.clear();
  log.info('All search sessions cleaned up');
}

module.exports = {
  handleSearchInteraction,
  isSearchInteraction,
  handleSearchSelect,
  handleSearchPagination,
  cleanupAllSessions,
  addSessionTimeout,
};
