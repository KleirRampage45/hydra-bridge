import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { HydraAPI } from './hydra-api';
import { HydraCDPClient } from './hydra-cdp';
import { parseSize } from './util';

/* ==================== COMBINED TOOL LIST ==================== */

const TOOL_DEFINITIONS: Tool[] = [
  // ─── SEARCH & CATALOGUE ───
  {
    name: 'hydra_search_games',
    description: 'Search for games in the Hydra catalogue',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Game title to search' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'hydra_get_repacks',
    description: 'Get all download repacks for a specific game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string', description: 'Game shop (e.g. steam)' },
        objectId: { type: 'string', description: 'Game object ID' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_get_random_game',
    description: 'Get a random game from the catalogue',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_get_game_stats',
    description: 'Get game statistics (player count, downloads, reviews)',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_get_game_shop_details',
    description: 'Get detailed store page info for a game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        language: { type: 'string', description: 'Language code (default: en)' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_get_game_assets',
    description: 'Get game cover/icon/screenshot assets',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_get_achievements',
    description: 'Get unlocked achievements for a game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },

  // ─── DOWNLOAD MANAGEMENT ───
  {
    name: 'hydra_start_download',
    description: 'Start downloading a game from a specific repack URI',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        title: { type: 'string' },
        shop: { type: 'string' },
        uri: { type: 'string', description: 'Download URI from the repack' },
        downloader: { type: 'number', description: 'Downloader enum value (0=RealDebrid, 1=Torrent, 2=Gofile, 3=PixelDrain, 4=Datanodes, 5=Mediafire, 6=TorBox, 7=Hydra, 9=FuckingFast, 10=VikingFile, 11=Rootz, 12=Premiumize, 13=AllDebrid)' },
        downloadPath: { type: 'string', description: 'Where to save the game' },
        automaticallyExtract: { type: 'boolean', default: true },
        automaticallyDeleteArchiveFiles: { type: 'boolean', default: true },
      },
      required: ['objectId', 'title', 'shop', 'uri', 'downloader', 'downloadPath'],
    },
  },
  {
    name: 'hydra_pause_download',
    description: 'Pause an active download',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_resume_download',
    description: 'Resume a paused download. Optionally specify strategy for what to do if another download is active.',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        strategy: { type: 'string', enum: ['interruptActive', 'queueIfActive'], description: 'What to do if another download is already active' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_cancel_download',
    description: 'Cancel an active or queued download',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_get_download_queue',
    description: 'Get the full download queue with position details',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_reorder_download',
    description: 'Move a download to a different area (hero=active, queue=waiting, paused=stopped)',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        targetArea: { type: 'string', enum: ['hero', 'queue', 'paused'], description: 'Where to move the download' },
        targetIndex: { type: 'number', description: 'Position within the target area (0 = first)' },
      },
      required: ['shop', 'objectId', 'targetArea'],
    },
  },
  {
    name: 'hydra_add_to_queue',
    description: 'Add a game to the download queue without starting immediately',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        title: { type: 'string' },
        shop: { type: 'string' },
        uri: { type: 'string', description: 'Download URI from the repack' },
        downloader: { type: 'number', description: 'Downloader enum value (0-13)' },
        downloadPath: { type: 'string', description: 'Where to save' },
        automaticallyExtract: { type: 'boolean', default: true },
        automaticallyDeleteArchiveFiles: { type: 'boolean', default: true },
      },
      required: ['objectId', 'title', 'shop', 'uri', 'downloader', 'downloadPath'],
    },
  },

  // ─── LIBRARY ───
  {
    name: 'hydra_get_library',
    description: 'Get installed games library',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_get_game_details',
    description: 'Get detailed info about a specific game (executable path, Proton config, playtime, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_favorite_game',
    description: 'Add or remove a game from favorites',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        favorite: { type: 'boolean', description: 'true to add to favorites, false to remove' },
      },
      required: ['shop', 'objectId', 'favorite'],
    },
  },
  {
    name: 'hydra_toggle_pin',
    description: 'Pin or unpin a game in the library',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        pinned: { type: 'boolean' },
      },
      required: ['shop', 'objectId', 'pinned'],
    },
  },
  {
    name: 'hydra_assign_collection',
    description: 'Assign a game to one or more collections',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        collectionIds: { type: 'array', items: { type: 'string' }, description: 'Collection IDs to assign the game to' },
      },
      required: ['shop', 'objectId', 'collectionIds'],
    },
  },
  {
    name: 'hydra_remove_game',
    description: 'Remove a game from the library. Optionally delete game files from disk.',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        deleteFiles: { type: 'boolean', description: 'Also delete game files from disk (default: false)' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_import_game',
    description: 'Add a custom (non-catalogue) game to the library by specifying its executable path',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Game title' },
        executablePath: { type: 'string', description: 'Full path to the game executable' },
        iconUrl: { type: 'string', description: 'Optional icon URL' },
        logoImageUrl: { type: 'string', description: 'Optional logo image URL' },
        libraryHeroImageUrl: { type: 'string', description: 'Optional hero/banner image URL' },
      },
      required: ['title', 'executablePath'],
    },
  },
  {
    name: 'hydra_scan_library',
    description: 'Scan for newly installed games and refresh the library',
    inputSchema: { type: 'object', properties: {} },
  },

  // ─── LAUNCH & PROTON CONFIG ───
  {
    name: 'hydra_launch_game',
    description: 'Launch a game from the library (auto-detects native ELF vs Proton)',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_set_executable_path',
    description: 'Set or clear the executable path for a game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        executablePath: { type: 'string', description: 'Full path to the exe/binary, or empty string to clear' },
      },
      required: ['shop', 'objectId', 'executablePath'],
    },
  },
  {
    name: 'hydra_set_proton_path',
    description: 'Set or clear the Proton path for a game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        protonPath: { type: 'string', description: 'Full path to Proton binary, or empty string to clear' },
      },
      required: ['shop', 'objectId', 'protonPath'],
    },
  },
  {
    name: 'hydra_set_launch_options',
    description: 'Set or clear launch options (environment vars, CLI flags) for a game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        launchOptions: { type: 'string', description: 'Launch options string, or empty string to clear' },
      },
      required: ['shop', 'objectId', 'launchOptions'],
    },
  },
  {
    name: 'hydra_get_proton_versions',
    description: 'List all installed Proton versions',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_get_game_launch_proton',
    description: 'Get the Proton version that would be used to launch a specific game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_create_shortcut',
    description: 'Create a desktop or start menu shortcut for a game',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        location: { type: 'string', enum: ['desktop', 'startmenu'], description: 'Where to place the shortcut' },
      },
      required: ['shop', 'objectId', 'location'],
    },
  },

  // ─── EXTRACTION ───
  {
    name: 'hydra_extract_game',
    description: 'Force re-extraction of a downloaded game archive',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_get_installer_action',
    description: 'Check what installer action is available for a game (e.g. needs install, ready to play)',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },
  {
    name: 'hydra_open_game_installer',
    description: 'Open the game installer to run any setup steps',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['shop', 'objectId'],
    },
  },

  // ─── SETTINGS & PREFERENCES ───
  {
    name: 'hydra_get_preferences',
    description: 'Get Hydra user preferences (download paths, Proton settings, etc.)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_update_preferences',
    description: 'Update Hydra user preferences',
    inputSchema: {
      type: 'object',
      properties: {
        downloadsPath: { type: 'string', description: 'Default downloads directory' },
        extractFilesByDefault: { type: 'boolean' },
        deleteArchiveFilesAfterExtractionByDefault: { type: 'boolean' },
        language: { type: 'string' },
      },
    },
  },
  {
    name: 'hydra_get_default_downloads_path',
    description: 'Get the system default downloads path that Hydra uses',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_get_disk_free_space',
    description: 'Get free disk space for a given path',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to check (e.g. /home or /mnt/hdd)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'hydra_get_available_drives',
    description: 'List available drives/partitions for game file transfers',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_transfer_game',
    description: 'Transfer installed game files to a different drive/parent directory',
    inputSchema: {
      type: 'object',
      properties: {
        shop: { type: 'string' },
        objectId: { type: 'string' },
        destParent: { type: 'string', description: 'Destination parent directory path' },
      },
      required: ['shop', 'objectId', 'destParent'],
    },
  },

  // ─── DOWNLOAD SOURCES ───
  {
    name: 'hydra_get_download_sources',
    description: 'Get configured download sources',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hydra_add_download_source',
    description: 'Add a new download source by URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Download source URL (e.g. https://example.com/repacks.json)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'hydra_remove_download_source',
    description: 'Remove a download source',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Download source URL to remove' },
        removeAll: { type: 'boolean', default: false, description: 'Remove all related content' },
      },
      required: ['url'],
    },
  },
  {
    name: 'hydra_sync_sources',
    description: 'Force sync all download sources to check for new repacks',
    inputSchema: { type: 'object', properties: {} },
  },

  // ─── LEVELDB DIRECT ACCESS ───
  {
    name: 'hydra_leveldb_get',
    description: 'Read a raw value from Hydra\'s internal LevelDB. Sublevel names: !games!, !downloads!, !gameShopAssets!, !gameShopCache!, !gameAchievements!, !userPreferences!, !gameStatsAssets!',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'DB key (e.g. !games!steam:427520)' },
        sublevelName: { type: 'string', description: 'Optional sublevel prefix' },
      },
      required: ['key'],
    },
  },
  {
    name: 'hydra_leveldb_values',
    description: 'List all values in a LevelDB sublevel (e.g. !games! to list all games)',
    inputSchema: {
      type: 'object',
      properties: {
        sublevelName: { type: 'string', description: 'Sublevel name like !games!, !downloads!, !gameShopCache!' },
      },
      required: ['sublevelName'],
    },
  },
  {
    name: 'hydra_get_auth',
    description: 'Get the current auth state (Hydra Cloud login status)',
    inputSchema: { type: 'object', properties: {} },
  },

  // ─── AUTO DOWNLOAD ───
  {
    name: 'hydra_auto_download',
    description: 'Autonomous download: search game, score repacks, pick best, start download with retry logic',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Game title to search and download' },
        downloadPath: { type: 'string', description: 'Where to save (auto-generated from game title if not provided — clean path, no torrent/download/temp words)' },
        preferPreinstalled: { type: 'boolean', default: true },
        preferLatest: { type: 'boolean', default: true },
        preferCompleteDLC: { type: 'boolean', default: true },
        maxRetries: { type: 'number', default: 3 },
      },
      required: ['query'],
    },
  },
];

export const TOOL_COUNT = TOOL_DEFINITIONS.length;

export function createHydraMCPServer(cdp: HydraCDPClient): Server {
  const api = new HydraAPI(cdp);

  const server = new Server(
    { name: 'hydra-bridge', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const rawArgs = request.params.arguments;
    const args: Record<string, unknown> = (typeof rawArgs === 'object' && rawArgs !== null) ? rawArgs as Record<string, unknown> : {};
    try {
      switch (name) {

        // ─── SEARCH & CATALOGUE ───
        case 'hydra_search_games': {
          const results = await api.searchGames(String(args.query || ''), Number(args.limit || 20));
          return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        }
        case 'hydra_get_repacks': {
          const repacks = await api.getRepacks(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify(repacks, null, 2) }] };
        }
        case 'hydra_get_random_game': {
          const game = await api.getRandomGame();
          return { content: [{ type: 'text', text: JSON.stringify(game, null, 2) }] };
        }
        case 'hydra_get_game_stats': {
          const stats = await api.getGameStats(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
        }
        case 'hydra_get_game_shop_details': {
          const details = await api.getGameShopDetails(
            String(args.shop || ''),
            String(args.objectId || ''),
            String(args.language || 'en')
          );
          return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
        }
        case 'hydra_get_game_assets': {
          const assets = await api.getGameAssets(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify(assets, null, 2) }] };
        }
        case 'hydra_get_achievements': {
          const achievements = await api.getUnlockedAchievements(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify(achievements, null, 2) }] };
        }

        // ─── DOWNLOAD MANAGEMENT ───
        case 'hydra_start_download': {
          const downloaderNum = typeof args.downloader === 'number' ? args.downloader : Number(args.downloader || 0);
          await api.startDownload({
            objectId: String(args.objectId || ''),
            title: String(args.title || ''),
            shop: String(args.shop || ''),
            uri: String(args.uri || ''),
            downloader: downloaderNum,
            downloadPath: String(args.downloadPath || ''),
            automaticallyExtract: Boolean(args.automaticallyExtract ?? true),
            automaticallyDeleteArchiveFiles: Boolean(args.automaticallyDeleteArchiveFiles ?? true),
            fileSize: String(args.fileSize || '') || null,
          });
          return { content: [{ type: 'text', text: 'Download started' }] };
        }
        case 'hydra_pause_download': {
          await api.pauseDownload(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: 'Download paused' }] };
        }
        case 'hydra_resume_download': {
          const strategy = args.strategy as 'interruptActive' | 'queueIfActive' | undefined;
          await api.resumeDownload(String(args.shop || ''), String(args.objectId || ''), strategy);
          return { content: [{ type: 'text', text: 'Download resumed' }] };
        }
        case 'hydra_cancel_download': {
          await api.cancelDownload(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: 'Download cancelled' }] };
        }
        case 'hydra_get_download_queue': {
          const state = await api.getDownloadState();
          // Enrich with library data to show full game info for each download
          const library = await api.getLibrary();
          const libMap = new Map<string, any>();
          for (const g of (library || [])) {
            const key = `${g.shop}:${g.objectId}`;
            libMap.set(key, g);
          }
          const enrich = (key: string) => {
            const [shop, objectId] = key.split(':');
            const libEntry = libMap.get(key);
            return { shop, objectId, title: libEntry?.title || objectId, iconUrl: libEntry?.iconUrl || null };
          };
          const result: any = { ...state };
          if (result.queueOrder) result.queue = result.queueOrder.map(enrich);
          if (result.pausedOrder) result.paused = result.pausedOrder.map(enrich);
          // Add the "hero" active download from library
          const active: any = (library || []).find((g: any) => g.download?.status === 'active');
          result.activeDownload = active ? {
            shop: active.shop,
            objectId: active.objectId,
            title: active.title,
            progress: active.download?.progress,
            status: active.download?.status,
            bytesDownloaded: active.download?.bytesDownloaded,
            downloadSpeed: active.download?.downloadSpeed,
          } : null;
          delete result.queueOrder;
          delete result.pausedOrder;
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'hydra_reorder_download': {
          await api.moveDownloadPlacement(
            String(args.shop || ''),
            String(args.objectId || ''),
            args.targetArea as 'hero' | 'queue' | 'paused',
            args.targetIndex !== undefined ? Number(args.targetIndex) : undefined
          );
          return { content: [{ type: 'text', text: `Moved ${args.objectId} to ${args.targetArea}` }] };
        }
        case 'hydra_add_to_queue': {
          const downloaderNum = typeof args.downloader === 'number' ? args.downloader : Number(args.downloader || 0);
          await api.addGameToQueue({
            objectId: String(args.objectId || ''),
            title: String(args.title || ''),
            shop: String(args.shop || ''),
            uri: String(args.uri || ''),
            downloader: downloaderNum,
            downloadPath: String(args.downloadPath || ''),
            automaticallyExtract: Boolean(args.automaticallyExtract ?? true),
            automaticallyDeleteArchiveFiles: Boolean(args.automaticallyDeleteArchiveFiles ?? true),
          });
          return { content: [{ type: 'text', text: 'Added to download queue' }] };
        }

        // ─── LIBRARY ───
        case 'hydra_get_library': {
          const library = await api.getLibrary();
          return { content: [{ type: 'text', text: JSON.stringify(library, null, 2) }] };
        }
        case 'hydra_get_game_details': {
          const game = await api.getGameByObjectId(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify(game, null, 2) }] };
        }
        case 'hydra_favorite_game': {
          if (args.favorite === true) {
            await api.addGameToFavorites(String(args.shop || ''), String(args.objectId || ''));
            return { content: [{ type: 'text', text: 'Added to favorites' }] };
          } else {
            await api.removeGameFromFavorites(String(args.shop || ''), String(args.objectId || ''));
            return { content: [{ type: 'text', text: 'Removed from favorites' }] };
          }
        }
        case 'hydra_toggle_pin': {
          await api.toggleGamePin(String(args.shop || ''), String(args.objectId || ''), Boolean(args.pinned));
          return { content: [{ type: 'text', text: args.pinned ? 'Game pinned' : 'Game unpinned' }] };
        }
        case 'hydra_assign_collection': {
          const ids = args.collectionIds as string[] || [];
          await api.assignGameToCollection(String(args.shop || ''), String(args.objectId || ''), ids);
          return { content: [{ type: 'text', text: `Assigned to ${ids.length} collection(s)` }] };
        }
        case 'hydra_remove_game': {
          const deleteFiles = Boolean(args.deleteFiles);
          await api.removeGameFromLibrary(String(args.shop || ''), String(args.objectId || ''));
          if (deleteFiles) {
            await api.deleteGameFolder(String(args.shop || ''), String(args.objectId || ''));
          }
          return { content: [{ type: 'text', text: deleteFiles ? 'Game removed + files deleted' : 'Game removed from library' }] };
        }
        case 'hydra_import_game': {
          const importParams: { title: string; executablePath: string; iconUrl?: string; logoImageUrl?: string; libraryHeroImageUrl?: string } = {
            title: String(args.title || ''),
            executablePath: String(args.executablePath || ''),
          };
          if (args.iconUrl) importParams.iconUrl = String(args.iconUrl);
          if (args.logoImageUrl) importParams.logoImageUrl = String(args.logoImageUrl);
          if (args.libraryHeroImageUrl) importParams.libraryHeroImageUrl = String(args.libraryHeroImageUrl);
          await api.addCustomGameToLibrary(importParams);
          return { content: [{ type: 'text', text: `Imported ${args.title} as a custom game` }] };
        }
        case 'hydra_scan_library': {
          await api.scanInstalledGames();
          return { content: [{ type: 'text', text: 'Library scan triggered' }] };
        }

        // ─── LAUNCH & PROTON ───
        case 'hydra_launch_game': {
          const result = await api.launchGameSmart(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'hydra_set_executable_path': {
          const exePath = String(args.executablePath || '');
          await api.updateExecutablePath(String(args.shop || ''), String(args.objectId || ''), exePath || null);
          return { content: [{ type: 'text', text: exePath ? `Executable path set to ${exePath}` : 'Executable path cleared' }] };
        }
        case 'hydra_set_proton_path': {
          const pp = String(args.protonPath || '');
          await api.selectGameProtonPath(String(args.shop || ''), String(args.objectId || ''), pp || null);
          return { content: [{ type: 'text', text: pp ? `Proton path set to ${pp}` : 'Proton path cleared' }] };
        }
        case 'hydra_set_launch_options': {
          const opts = String(args.launchOptions || '');
          await api.updateLaunchOptions(String(args.shop || ''), String(args.objectId || ''), opts || null);
          return { content: [{ type: 'text', text: opts ? 'Launch options updated' : 'Launch options cleared' }] };
        }
        case 'hydra_get_proton_versions': {
          const versions = await api.getInstalledProtonVersions();
          return { content: [{ type: 'text', text: JSON.stringify(versions, null, 2) }] };
        }
        case 'hydra_get_game_launch_proton': {
          const info = await api.getGameLaunchProtonVersion(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
        }
        case 'hydra_create_shortcut': {
          await api.createGameShortcut(String(args.shop || ''), String(args.objectId || ''), args.location as 'desktop' | 'startmenu');
          return { content: [{ type: 'text', text: `Shortcut created on ${args.location}` }] };
        }

        // ─── EXTRACTION ───
        case 'hydra_extract_game': {
          await api.extractGameDownload(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: 'Extraction triggered' }] };
        }
        case 'hydra_get_installer_action': {
          const action = await api.getGameInstallerActionType(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: JSON.stringify({ action }) }] };
        }
        case 'hydra_open_game_installer': {
          await api.openGameInstaller(String(args.shop || ''), String(args.objectId || ''));
          return { content: [{ type: 'text', text: 'Installer opened' }] };
        }

        // ─── SETTINGS & PREFERENCES ───
        case 'hydra_get_preferences': {
          const prefs = await api.getPreferences();
          return { content: [{ type: 'text', text: JSON.stringify(prefs, null, 2) }] };
        }
        case 'hydra_update_preferences': {
          const prefs: Record<string, any> = {};
          if (args.downloadsPath !== undefined) prefs.downloadsPath = String(args.downloadsPath);
          if (args.extractFilesByDefault !== undefined) prefs.extractFilesByDefault = Boolean(args.extractFilesByDefault);
          if (args.deleteArchiveFilesAfterExtractionByDefault !== undefined) prefs.deleteArchiveFilesAfterExtractionByDefault = Boolean(args.deleteArchiveFilesAfterExtractionByDefault);
          if (args.language !== undefined) prefs.language = String(args.language);
          await api.updateUserPreferences(prefs);
          return { content: [{ type: 'text', text: 'Preferences updated' }] };
        }
        case 'hydra_get_default_downloads_path': {
          const path = await api.getDefaultDownloadsPath();
          return { content: [{ type: 'text', text: JSON.stringify({ defaultDownloadsPath: path }) }] };
        }
        case 'hydra_get_disk_free_space': {
          const space = await api.getDiskFreeSpace(String(args.path || ''));
          return { content: [{ type: 'text', text: JSON.stringify(space, null, 2) }] };
        }
        case 'hydra_get_available_drives': {
          const drives = await api.getAvailableDrives();
          return { content: [{ type: 'text', text: JSON.stringify(drives, null, 2) }] };
        }
        case 'hydra_transfer_game': {
          await api.transferGameFiles(String(args.shop || ''), String(args.objectId || ''), String(args.destParent || ''));
          return { content: [{ type: 'text', text: 'Game transfer initiated' }] };
        }

        // ─── DOWNLOAD SOURCES ───
        case 'hydra_get_download_sources': {
          const sources = await api.getDownloadSources();
          return { content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }] };
        }
        case 'hydra_add_download_source': {
          await api.addDownloadSource(String(args.url || ''));
          return { content: [{ type: 'text', text: 'Download source added' }] };
        }
        case 'hydra_remove_download_source': {
          await api.removeDownloadSource(String(args.url || ''), Boolean(args.removeAll));
          return { content: [{ type: 'text', text: 'Download source removed' }] };
        }
        case 'hydra_sync_sources': {
          await api.syncDownloadSources();
          return { content: [{ type: 'text', text: 'Download sources synced' }] };
        }

        // ─── LEVELDB ───
        case 'hydra_leveldb_get': {
          const value = await api.leveldbGet(String(args.key || ''), args.sublevelName ? String(args.sublevelName) : undefined);
          return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
        }
        case 'hydra_leveldb_values': {
          const values = await api.leveldbValues(String(args.sublevelName || ''));
          return { content: [{ type: 'text', text: JSON.stringify(values, null, 2) }] };
        }
        case 'hydra_get_auth': {
          const auth = await api.getAuth();
          return { content: [{ type: 'text', text: JSON.stringify(auth, null, 2) }] };
        }

        // ─── AUTO DOWNLOAD ───
        case 'hydra_auto_download': {
          const result = await autoDownload(api, {
            query: String(args.query || ''),
            downloadPath: cleanDownloadPath(String(args.query || ''), args.downloadPath ? String(args.downloadPath) : undefined),
            preferPreinstalled: Boolean(args.preferPreinstalled ?? true),
            preferLatest: Boolean(args.preferLatest ?? true),
            preferCompleteDLC: Boolean(args.preferCompleteDLC ?? true),
            maxRetries: Number(args.maxRetries || 3),
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message || error}` }], isError: true };
    }
  });

  return server;
}

/* ==================== AUTO DOWNLOAD LOGIC ==================== */

async function autoDownload(api: HydraAPI, opts: {
  query: string;
  downloadPath: string;
  preferPreinstalled: boolean;
  preferLatest: boolean;
  preferCompleteDLC: boolean;
  maxRetries: number;
}) {
  const { query, downloadPath, preferPreinstalled, preferLatest, preferCompleteDLC, maxRetries } = opts;

  const searchResults = await api.searchGames(query, 10);
  if (!searchResults.length) return { success: false, reason: 'No games found' };
  const game = searchResults[0]!;

  const repacks = await api.getRepacks(game.shop, game.objectId);
  if (!repacks.length) return { success: false, reason: 'No repacks available', game };

  const scored = repacks.map((r: any) => {
    let score = 0;
    const titleLower = (r.title || '').toLowerCase();

    if (preferPreinstalled && /pre[-\\s]?install|preinstall|ready[-\\s]?to[-\\s]?play|no[-\\s]?install/.test(titleLower)) score += 50;
    if (preferLatest && /latest|v\\d+\\.\\d+|update|build/.test(titleLower)) score += 20;
    if (preferCompleteDLC && (/all[-\\s]?dlc|complete[-\\s]?edition|deluxe|ultimate|goty/.test(titleLower) || r.uris.length > 2)) score += 30;

    const hasDirect = r.uris.some((u: string) => !u.startsWith('magnet:'));
    if (hasDirect) score += 15;

    const age = Date.now() - new Date(r.uploadDate || 0).getTime();
    const ageDays = age / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - ageDays);

    const sizeBytes = parseSize(r.fileSize);
    if (sizeBytes > 50 * 1024 ** 3) score -= 10;

    return { ...r, score, sizeBytes };
  });

  scored.sort((a: any, b: any) => b.score - a.score);

  let attempt = 0;
  for (const repack of scored) {
    if (attempt >= maxRetries) break;
    attempt++;

    for (const uri of repack.uris || []) {
      const downloader = inferDownloader(uri);
      if (!downloader) continue;

      try {
        await api.startDownload({
          objectId: game.objectId,
          title: game.title,
          shop: game.shop,
          uri,
          downloader,
          downloadPath,
          automaticallyExtract: true,
          automaticallyDeleteArchiveFiles: true,
          fileSize: repack.fileSize,
        });

        return {
          success: true,
          game: { title: game.title, objectId: game.objectId, shop: game.shop },
          repack: { title: repack.title, source: repack.downloadSourceName, uri, downloader },
          attempt,
          downloadPath,
        };
      } catch (e: any) {
        console.log(`[AutoDownload] Attempt ${attempt} failed for ${uri}: ${e.message}`);
        continue;
      }
    }
  }

  return { success: false, reason: `All ${maxRetries} attempts failed`, game, scored: scored.slice(0, 3) };
}

function inferDownloader(uri: string): number | null {
  if (uri.startsWith('magnet:')) return 1; // Torrent
  if (uri.includes('gofile.io')) return 2; // Gofile
  if (uri.includes('pixeldrain.com')) return 3; // PixelDrain
  if (uri.includes('datanodes.to')) return 4; // Datanodes
  if (uri.includes('mediafire.com')) return 5; // Mediafire
  if (uri.includes('fuckingfast.co')) return 9; // FuckingFast
  if (uri.includes('vikingfile.com') || uri.includes('vik1ngfile')) return 10; // VikingFile
  if (uri.includes('rootz.so')) return 11; // Rootz
  if (uri.includes('1fichier.com')) return 0; // RealDebrid
  if (uri.includes('premiumize.me')) return 12; // Premiumize
  if (uri.includes('alldebrid.com')) return 13; // AllDebrid
  return null;
}

function sanitizePathName(title: string): string {
  const BAD_PATTERNS = /torrent|download|temp|tmp|crack|warez|pirate|hack|keygen|patch|serial|cracked/gi;

  let cleaned = title
    .replace(/[^a-zA-Z0-9\s\-_.:]/g, '')
    .replace(BAD_PATTERNS, '')
    .replace(/[_\-.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    || 'Game';

  return cleaned.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '') || 'Game';
}

function cleanDownloadPath(gameTitle: string, userPath?: string): string {
  if (userPath) {
    const parts = userPath.split('/').filter(Boolean);
    const cleaned = parts.map(sanitizePathName);
    return '/' + cleaned.join('/');
  }
  const os = require('os');
  const clean = sanitizePathName(gameTitle);
  return `${os.homedir()}/Games/${clean}`;
}

export async function runMCPServer(cdp: HydraCDPClient) {
  const server = createHydraMCPServer(cdp);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('[MCP] Server running on stdio');
}
