# Advanced Music Search System Guide

## Overview
The TON618 Music bot now includes an advanced search system with caching, pagination, and multi-platform support. This guide documents all components and usage.

## Features

### 1. `/search` Command
Search for songs without auto-playing them.

```
/search query:<song_name_or_artist> [source:youtube|spotify]
```

**Parameters:**
- `query` (required): Song name or artist to search for
- `source` (optional): YouTube (default) or Spotify

**Features:**
- Results cached for 1 hour to reduce API calls
- Displays up to 25 results per page
- Automatic pagination for large result sets
- Shows track duration and artist information
- Cache indicator (⚡ Cached) when using cached results

### 2. Search Result Display

The bot shows search results in an embed with:
- Track title
- Artist name
- Duration (HH:MM:SS format)
- Source (YouTube, Spotify, etc.)
- Pagination information (Page X/Y)
- Cache status

### 3. Selection and Queuing

Users can:
- **Select a track** from the dropdown menu (up to 25 options per page)
- **Navigate pages** using Previous/Next buttons (if results > 25)
- **Close search** using the Close button

Selecting a track:
- Automatically enqueues the song
- Shows "Added to Queue" confirmation
- Displays position in queue
- Auto-plays if nothing is currently playing

## Architecture

### Core Components

#### 1. SearchCacheService (`src/services/SearchCacheService.js`)
Manages search result caching and session tracking.

**Features:**
- Caches search results for 1 hour (3600000ms)
- Stores session tracks for 5 minutes (300000ms)
- Automatic cleanup of expired entries
- Supports up to 100 cached queries
- LRU (Least Recently Used) strategy for cache eviction

**Key Methods:**
```javascript
// Cache search results
searchCache.setCache(query, results, engine);

// Get cached results
const results = searchCache.getCache(query, engine);

// Store user's search session
searchCache.setSessionTracks(userId, tracks);

// Get paginated results
const pagination = searchCache.getPaginatedResults(userId, pageNum);

// Get track by index
const track = searchCache.getTrackByIndex(userId, index);

// Clear user session
searchCache.clearSession(userId);

// Get statistics
const stats = searchCache.getStats();
```

#### 2. Command: `/search` (`src/commands/search.js`)
Slash command that initiates a search.

**Flow:**
1. User runs `/search` with query
2. Check cache for previous results
3. If not cached, call MusicManager.search()
4. Cache results for future queries
5. Display first page with select menu and pagination buttons
6. Wait for user interaction

#### 3. Components (`src/utils/musicComponents.js`)

**createSearchSelectMenu(tracks, userId, options)**
- Creates a StringSelectMenu with up to 25 track options
- Custom ID: `music:search:select:userId`
- Shows track title, artist, and duration

**createSearchPaginationButtons(userId, pagination, options)**
- Creates Previous/Next/Close buttons
- Custom IDs: `music:search:pagination:userId:action:page`
- Actions: `prev`, `next`, `close`

#### 4. Embeds (`src/utils/musicEmbeds.js`)

**createSearchResultEmbed(tracks, query, options)**
- Formats search results as Discord embed
- Shows track list with numbering
- Displays pagination info and cache status
- Supports multi-language (EN/ES)

#### 5. Handler (`src/handlers/musicSearchHandler.js`)

**isSearchInteraction(customId)**
- Detects if interaction is search-related

**handleSearchInteraction(interaction, context)**
- Routes select menu and pagination interactions
- Calls specific handlers based on interaction type

**handleSearchSelect(interaction, context)**
- Processes when user selects a track
- Enqueues track to player
- Shows confirmation

**handleSearchPagination(interaction, context)**
- Processes pagination button clicks
- Updates embed with new page
- Handles close action

## Cache Strategy

### Cache Key Format
```
<engine>:<lowercase_query>
```

### TTL (Time To Live)
- **Search results**: 1 hour (3600000ms)
- **Session tracks**: 5 minutes (300000ms)

### Cleanup
- Automatic cleanup every 60 seconds
- Removes expired cache entries
- Removes expired session tracks
- Tracks LRU for cache size management

### Cache Stats
```javascript
const stats = searchCache.getStats();
// Returns: { cacheSize, activeSessions, cacheHits }
```

## Pagination Strategy

### Results Per Page
- **Maximum options per select menu**: 25
- **Limit from tier**: FREE: 100 tracks, PRO: 500 tracks

### Pagination Info
```
{
  tracks: [...],           // Current page results
  pageNum: 0,              // Current page (0-indexed)
  totalPages: 4,           // Total pages available
  totalTracks: 100,        // Total results
  hasNext: true,           // Can go to next page
  hasPrev: false,          // Can go to previous page
  startIdx: 1,             // First result number on page
  endIdx: 25               // Last result number on page
}
```

## Multi-Platform Support

### Supported Engines
- **YouTube** (default): Fast, most results
- **Spotify**: Needs configuration

### Engine Selection
Users can specify source in `/search`:
```
/search query:song_name source:spotify
```

### Source Labels in Response
- YouTube → "YouTube"
- YouTube Music → "YouTube Music"
- Spotify → "Spotify"
- SoundCloud → "SoundCloud"
- Apple Music → "Apple Music"
- Deezer → "Deezer"
- Bandcamp → "Bandcamp"
- Twitch → "Twitch"
- Vimeo → "Vimeo"

## Session Management

### Session Lifetime
- Created when user receives search results
- Expires after 5 minutes of inactivity
- Auto-cleanup on `/search` close
- Manual cleanup on bot shutdown

### Session Tracking
```javascript
// Sessions stored by: session:userId
searchCache.getSessionTracks(userId);
searchCache.setCurrentPage(userId, pageNum);
searchCache.clearSession(userId);
```

## Error Handling

### Common Errors

**1. Music Service Not Available**
- Cause: MusicManager or SearchCache not initialized
- Response: Ephemeral error message

**2. Search Failed**
- Cause: API error or network issue
- Response: Shows error message from API

**3. No Results**
- Cause: Query doesn't match any songs
- Response: "No results found for: {query}"

**4. Invalid Page**
- Cause: User tries to access non-existent page
- Response: "Invalid page" message

**5. Track Not Found**
- Cause: Session expired or track index invalid
- Response: "Song not found" message

## Integration Points

### With `/play` Command
The search system can be integrated with `/play`:
1. If `/play` returns > 1 result, show search menu instead
2. User can select from dropdown
3. Single result auto-plays as before

### With Music Controls
- Search results don't interfere with music playback
- Player controls remain active
- Search sessions are independent

## Performance Metrics

### Cache Efficiency
- **Hit rate**: Tracks how many searches use cached results
- **Session cleanup**: Automatic after 5 minutes
- **Memory usage**: Max 100 cached queries + active sessions

### Response Times
- **Cached search**: <100ms (instant)
- **New search**: 1-3 seconds (API dependent)
- **Pagination**: <50ms (instant)

### Rate Limiting
- No specific rate limit for `/search` command
- Subject to global command cooldown (1.5 seconds)
- Guild cooldown (800ms) prevents spam

## Usage Examples

### Example 1: Basic Search
```
User: /search query:bohemian rhapsody
Bot: Shows 4 pages of results
     User clicks dropdown → selects track
Bot: "✅ Added to Queue (Position: 5)"
```

### Example 2: Cached Search
```
User: /search query:bohemian rhapsody
Bot: Shows results with "⚡ Cached" indicator
     (3rd page this hour - no API call made)
```

### Example 3: Spotify Search
```
User: /search query:blinding lights source:spotify
Bot: Shows Spotify results specifically
     User navigates 5 pages and selects
Bot: Enqueues Spotify track
```

### Example 4: No Results
```
User: /search query:xyzabcnotasong
Bot: "🔍 No Results"
     "No songs found for: xyzabcnotasong"
```

## Troubleshooting

### Search Returns No Results
1. Check query spelling
2. Try a different source (YouTube vs Spotify)
3. Try artist name instead of full song
4. Ensure song exists on selected platform

### Pagination Not Showing
- Normal if results < 25 tracks
- If > 25 results, pagination buttons should appear
- Check if cache is full (max 100 cached queries)

### Selected Track Not Queuing
1. Check if bot is connected to voice
2. Verify user is in voice channel
3. Check bot voice permissions
4. Session may have expired (5 minute timeout)

### Cache Not Working
1. Check if SearchCacheService initialized
2. Verify cache TTL settings
3. Look for cleanup issues in logs

## Admin Commands (Future)

```javascript
// View cache stats (admin)
!search-stats

// Clear cache (admin)
!search-cache-clear

// Clear specific user session (admin)
!search-session-clear @user
```

## Configuration

### Environment Variables
```
# Cache settings (optional, use defaults if not set)
SEARCH_CACHE_TTL=3600000          # 1 hour
SEARCH_SESSION_TTL=300000         # 5 minutes
SEARCH_MAX_CACHE_SIZE=100         # Max queries cached
```

### Runtime Configuration
```javascript
// In index.js
client.searchCache = new SearchCacheService({
  cacheTTL: 3600000,           // 1 hour
  maxSessionTTL: 300000,       // 5 minutes
  maxCacheSize: 100,           // Max cached queries
  maxSelectMenuOptions: 25,    // Discord limit
  maxPaginationResults: 100,   // Max total results
});
```

## Future Enhancements

### Planned Features
1. **Search filters**: By duration, date added, popularity
2. **Recent searches**: Per-user search history
3. **Favorites**: Save frequently searched queries
4. **Search suggestions**: Auto-complete while typing
5. **Advanced sort**: By relevance, duration, popularity
6. **Playlist results**: Show matching playlists

### Performance Improvements
1. **Redis cache**: Replace in-memory cache with Redis
2. **Async search**: Non-blocking search for multiple users
3. **Search analytics**: Track popular searches
4. **Query optimization**: Suggest similar queries

### Analytics
1. **Most searched queries**: Top 10 per guild
2. **Search success rate**: % of searches with results
3. **Average results per query**: Metrics
4. **Popular sources**: YouTube vs Spotify usage

## Support

For issues or feature requests:
1. Check this guide first
2. Review error messages in bot logs
3. Contact bot admin or maintainers
4. Report bugs with: `/debug search`

## Related Documentation

- [Music Bot Guide](README.md)
- [Music Controls Guide](MUSIC_CONTROLS.md)
- [Queue Management Guide](QUEUE_GUIDE.md)
- [Lavalink Configuration](lavalink/README.md)
