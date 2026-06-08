/**
 * Search Cache Service
 * Caches search results to avoid repeated API calls
 * Supports multiple search engines: YouTube, Spotify, etc.
 */

const { createLogger } = require('../utils/logger');

const log = createLogger('SearchCacheService');

class SearchCacheService {
  constructor(options = {}) {
    this.cache = new Map();
    this.sessionTracks = new Map(); // Store actual track objects for selections
    
    // Configuration
    this.maxCacheSize = options.maxCacheSize || 100;
    this.cacheTTL = options.cacheTTL || 3600000; // 1 hour
    this.maxSessionTTL = options.maxSessionTTL || 300000; // 5 minutes
    this.maxPaginationResults = options.maxPaginationResults || 100;
    this.maxSelectMenuOptions = options.maxSelectMenuOptions || 25; // Discord max is 25
    
    // Cleanup old entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Generate cache key from query and engine
   */
  getCacheKey(query, engine = 'youtube') {
    return `${engine}:${query.toLowerCase().trim()}`;
  }

  /**
   * Generate session key from user ID
   */
  getSessionKey(userId) {
    return `session:${userId}`;
  }

  /**
   * Store search results in cache
   * @param {string} query - Search query
   * @param {Object} results - Search results from Kazagumo
   * @param {string} engine - Search engine (youtube, spotify)
   */
  setCache(query, results, engine = 'youtube') {
    const key = this.getCacheKey(query, engine);
    
    const cacheEntry = {
      results,
      timestamp: Date.now(),
      hits: 0,
    };

    this.cache.set(key, cacheEntry);

    // Limit cache size
    if (this.cache.size > this.maxCacheSize) {
      // Remove least recently used entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    log.debug('Cache set', { query, engine, trackCount: results.tracks?.length || 0 });
    return cacheEntry;
  }

  /**
   * Get search results from cache (if available)
   * @returns {Object|null} Cached results or null if not found/expired
   */
  getCache(query, engine = 'youtube') {
    const key = this.getCacheKey(query, engine);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count and move to end (LRU strategy)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    log.debug('Cache hit', { query, engine, hits: entry.hits });
    return entry.results;
  }

  /**
   * Store session tracks for a user's search result
   * Allows pagination and selection
   * @param {string} userId - Discord user ID
   * @param {Array} tracks - Full track array from search
   */
  setSessionTracks(userId, tracks) {
    const key = this.getSessionKey(userId);
    
    const sessionEntry = {
      tracks,
      timestamp: Date.now(),
      currentPage: 0,
    };

    this.sessionTracks.set(key, sessionEntry);

    log.debug('Session tracks set', { userId, trackCount: tracks.length });
    return sessionEntry;
  }

  /**
   * Get session tracks
   */
  getSessionTracks(userId) {
    const key = this.getSessionKey(userId);
    const entry = this.sessionTracks.get(key);

    if (!entry) {
      return null;
    }

    // Check if session expired
    if (Date.now() - entry.timestamp > this.maxSessionTTL) {
      this.sessionTracks.delete(key);
      return null;
    }

    return entry.tracks;
  }

  /**
   * Get paginated results
   * @param {string} userId - User ID
   * @param {number} pageNum - Page number (0-indexed)
   * @returns {Object} { tracks, pageNum, totalPages, hasNext, hasPrev }
   */
  getPaginatedResults(userId, pageNum = 0) {
    const tracks = this.getSessionTracks(userId);

    if (!tracks) {
      return null;
    }

    const itemsPerPage = this.maxSelectMenuOptions;
    const totalPages = Math.ceil(tracks.length / itemsPerPage);

    // Validate page number
    if (pageNum < 0 || pageNum >= totalPages) {
      return null;
    }

    const startIdx = pageNum * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, tracks.length);
    const pageResults = tracks.slice(startIdx, endIdx);

    return {
      tracks: pageResults,
      pageNum,
      totalPages,
      totalTracks: tracks.length,
      hasNext: pageNum < totalPages - 1,
      hasPrev: pageNum > 0,
      startIdx: startIdx + 1,
      endIdx,
    };
  }

  /**
   * Set current page for user session
   */
  setCurrentPage(userId, pageNum) {
    const key = this.getSessionKey(userId);
    const entry = this.sessionTracks.get(key);

    if (entry) {
      entry.currentPage = pageNum;
    }
  }

  /**
   * Get current page for user
   */
  getCurrentPage(userId) {
    const key = this.getSessionKey(userId);
    const entry = this.sessionTracks.get(key);

    return entry ? entry.currentPage : 0;
  }

  /**
   * Get track by index from user session
   */
  getTrackByIndex(userId, index) {
    const tracks = this.getSessionTracks(userId);

    if (!tracks || index < 0 || index >= tracks.length) {
      return null;
    }

    return tracks[index];
  }

  /**
   * Clear user session
   */
  clearSession(userId) {
    const key = this.getSessionKey(userId);
    this.sessionTracks.delete(key);
    log.debug('Session cleared', { userId });
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cacheCleanups = 0;
    let sessionCleanups = 0;

    // Cleanup cache
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.cache.delete(key);
        cacheCleanups++;
      }
    }

    // Cleanup sessions
    for (const [key, entry] of this.sessionTracks.entries()) {
      if (now - entry.timestamp > this.maxSessionTTL) {
        this.sessionTracks.delete(key);
        sessionCleanups++;
      }
    }

    if (cacheCleanups > 0 || sessionCleanups > 0) {
      log.debug('Cache cleanup completed', { cacheCleanups, sessionCleanups });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      activeSessions: this.sessionTracks.size,
      cacheHits: Array.from(this.cache.values()).reduce((sum, e) => sum + e.hits, 0),
    };
  }

  /**
   * Destroy service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.sessionTracks.clear();
    log.info('SearchCacheService destroyed');
  }
}

module.exports = { SearchCacheService };
