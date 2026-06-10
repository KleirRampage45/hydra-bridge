import { HydraCDPClient } from './hydra-cdp';

export interface GameSearchResult {
  objectId: string;
  shop: string;
  title: string;
  iconUrl: string | null;
  coverImageUrl: string | null;
}

export interface GameRepack {
  id: string;
  title: string;
  fileSize: string | null;
  uris: string[];
  unavailableUris: string[];
  uploadDate: string | null;
  downloadSourceId: string;
  downloadSourceName: string;
  createdAt: string;
}

export interface DownloadProgress {
  downloadSpeed: number;
  timeRemaining: number;
  numPeers: number;
  numSeeds: number;
  isDownloadingMetadata: boolean;
  isCheckingFiles: boolean;
  progress: number;
  gameId: string;
  download: any;
  batchFilesTotal?: number;
  batchFilesDownloaded?: number;
}

export interface DownloadEntry {
  objectId: string;
  shop: string;
  title: string;
  progress: number;
  status: string;
  downloadPath: string;
  downloader: string;
  bytesDownloaded: number;
  fileSize: number | null;
  extracting: boolean;
  extractionProgress?: number;
  queued: boolean;
}

export interface LibraryEntry {
  objectId: string;
  shop: string;
  title: string;
  iconUrl: string | null;
  coverImageUrl: string | null;
  playTimeInSeconds: number;
  lastTimePlayed: Date | null;
}

export interface UserPreferences {
  downloadsPath?: string | null;
  downloadDirectories?: any[];
  extractFilesByDefault?: boolean;
  deleteArchiveFilesAfterExtractionByDefault?: boolean;
  defaultProtonPath?: string | null;
  language?: string;
}

export class HydraAPI {
  constructor(private cdp: HydraCDPClient) {}

  async searchGames(query: string, limit = 20): Promise<GameSearchResult[]> {
    const result = await this.cdp.evaluate(`
      (async () => {
        const response = await window.electron.hydraApi.post('/catalogue/search', {
          data: {
            title: ${JSON.stringify(query)},
            sortBy: 'popularity',
            sortOrder: 'desc',
            downloadSourceFingerprints: [],
            tags: [],
            publishers: [],
            genres: [],
            developers: [],
            protondbSupportBadges: [],
            deckCompatibility: [],
            downloadSourceIds: [],
            take: ${limit},
            skip: 0,
          },
          needsAuth: false,
        });
        return response;
      })()
    `);
    return result?.edges || [];
  }

  async getRepacks(shop: string, objectId: string): Promise<GameRepack[]> {
    return await this.cdp.evaluate(`
      (async () => {
        const sources = await window.electron.getDownloadSources();
        const sourceIds = sources.map(s => s.id);
        const response = await window.electron.hydraApi.get(
          '/games/${shop}/${objectId}/download-sources',
          {
            params: { take: 100, skip: 0, downloadSourceIds: sourceIds },
            needsAuth: false,
          }
        );
        return response;
      })()
    `);
  }

  async startDownload(payload: {
    objectId: string;
    title: string;
    shop: string;
    uri: string;
    downloadPath: string;
    downloader: number;
    automaticallyExtract: boolean;
    automaticallyDeleteArchiveFiles: boolean;
    fileSize?: string | null;
  }): Promise<void> {
    const result = await this.cdp.evaluate(`
      (async () => {
        return await window.electron.startGameDownload(${JSON.stringify(payload)});
      })()
    `);
    if (result && result.ok === false) {
      throw new Error(result.error || 'Download failed');
    }
  }

  async cancelDownload(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.cancelGameDownload('${shop}', '${objectId}');
      })()
    `);
  }

  async getDownloads(): Promise<DownloadEntry[]> {
    return await this.cdp.evaluate(`
      (async () => {
        const layout = await window.electron.getDownloadLayoutState();
        const allKeys = [...layout.queueOrder, ...layout.pausedOrder];
        const downloads = [];
        for (const key of allKeys) {
          const [shop, objectId] = key.split(':');
          const entry = await window.electron.getLibrary();
          // Actually getLibrary returns games, not downloads. 
          // We need to iterate the download entries directly via leveldb.
        }
        // Simpler: use the download progress listener state
        const state = await window.electron.getDownloadLayoutState();
        return state;
      })()
    `);
  }

  async getLibrary(): Promise<LibraryEntry[]> {
    const result = await this.cdp.evaluate(`
      (async () => {
        const response = await window.electron.getLibrary();
        return response;
      })()
    `);
    return result?.library || [];
  }

  async getPreferences(): Promise<UserPreferences> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getUserPreferences();
      })()
    `);
  }

  async getDownloadSources(): Promise<any[]> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getDownloadSources();
      })()
    `);
  }

  async openGame(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.openGame('${shop}', '${objectId}');
      })()
    `);
  }

  /**
   * Smart launcher: checks the library, and if the executable is a native ELF binary,
   * spawns it directly via child_process to bypass KIO. Falls back to Hydra's launcher
   * for Windows games that need Proton.
   */
  async launchGameSmart(shop: string, objectId: string): Promise<{ method: 'native' | 'hydra'; executable?: string; error?: string }> {
    // Get the game from Hydra's library to find the executable path
    const gameInfo: any = await this.cdp.evaluate(`
      (async () => {
        const library = await window.electron.getLibrary();
        const game = library.find(g => g.shop === '${shop}' && g.objectId === '${objectId}');
        if (!game) return null;
        return {
          title: game.title,
          executablePath: game.executablePath || null,
          protonPath: game.protonPath || null,
        };
      })()
    `);

    if (!gameInfo?.executablePath) {
      // No executable set — fall back to Hydra
      await this.openGame(shop, objectId);
      return { method: 'hydra', error: 'No executable path set — used Hydra fallback' };
    }

    const { execFile } = require('child_process');
    const path = require('path');
    const exePath = gameInfo.executablePath as string;
    const cwd = path.dirname(exePath);

    // Check if native Linux ELF (no Proton path set)
    if (!gameInfo.protonPath) {
      console.log(`[HydraAPI] Launching native: ${exePath}`);
      const child = execFile(exePath, [], { cwd, detached: true, stdio: 'ignore' });
      child.unref();
      return { method: 'native', executable: exePath };
    }

    // Has Proton — let Hydra handle it
    console.log(`[HydraAPI] Proton game — delegating to Hydra: ${exePath}`);
    await this.openGame(shop, objectId);
    return { method: 'hydra', executable: exePath };
  }

  async listenForDownloadProgress(timeoutMs = 30000): Promise<DownloadProgress | null> {
    const result = await this.cdp.evaluate(`
      (async () => {
        return new Promise((resolve) => {
          const cleanup = window.electron.onDownloadProgress((progress) => {
            cleanup();
            resolve(progress);
          });
          setTimeout(() => {
            cleanup();
            resolve(null);
          }, ${timeoutMs});
        });
      })()
    `);
    return result;
  }

  async getDownloadState(): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        const layout = await window.electron.getDownloadLayoutState();
        return layout;
      })()
    `);
  }

  /* ==================== DOWNLOAD MANAGEMENT ==================== */

  async pauseDownload(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.pauseGameDownload('${shop}', '${objectId}');
      })()
    `);
  }

  async resumeDownload(shop: string, objectId: string, strategy?: 'interruptActive' | 'queueIfActive'): Promise<void> {
    const strat = strategy ? `'${strategy}'` : 'undefined';
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.resumeGameDownload('${shop}', '${objectId}', ${strat});
      })()
    `);
  }

  async addGameToQueue(payload: {
    objectId: string;
    title: string;
    shop: string;
    uri: string;
    downloadPath: string;
    downloader: number;
    automaticallyExtract: boolean;
    automaticallyDeleteArchiveFiles: boolean;
    fileSize?: string | null;
  }): Promise<void> {
    const result = await this.cdp.evaluate(`
      (async () => {
        return await window.electron.addGameToQueue(${JSON.stringify(payload)});
      })()
    `);
    if (result && result.ok === false) {
      throw new Error(result.error || 'Queue add failed');
    }
  }

  async updateDownloadQueuePosition(shop: string, objectId: string, direction: 'up' | 'down'): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.updateDownloadQueuePosition('${shop}', '${objectId}', '${direction}');
      })()
    `);
  }

  async setDownloadQueuePosition(shop: string, objectId: string, targetIndex: number): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.setDownloadQueuePosition('${shop}', '${objectId}', ${targetIndex});
      })()
    `);
  }

  async setPausedDownloadPosition(shop: string, objectId: string, targetIndex: number): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.setPausedDownloadPosition('${shop}', '${objectId}', ${targetIndex});
      })()
    `);
  }

  async moveDownloadPlacement(shop: string, objectId: string, targetArea: 'hero' | 'queue' | 'paused', targetIndex?: number): Promise<void> {
    const idx = targetIndex !== undefined ? targetIndex : 'undefined';
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.moveDownloadPlacement('${shop}', '${objectId}', '${targetArea}', ${idx});
      })()
    `);
  }

  /* ==================== PROTON & LAUNCH CONFIG ==================== */

  async updateExecutablePath(shop: string, objectId: string, executablePath: string | null): Promise<void> {
    const exePath = executablePath === null ? null : `'${executablePath}'`;
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.updateExecutablePath('${shop}', '${objectId}', ${exePath});
      })()
    `);
  }

  async selectGameProtonPath(shop: string, objectId: string, protonPath: string | null): Promise<void> {
    const pp = protonPath === null ? null : `'${protonPath}'`;
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.selectGameProtonPath('${shop}', '${objectId}', ${pp});
      })()
    `);
  }

  async updateLaunchOptions(shop: string, objectId: string, launchOptions: string | null): Promise<void> {
    const opts = launchOptions === null ? null : `'${launchOptions.replace(/'/g, "\\'")}'`;
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.updateLaunchOptions('${shop}', '${objectId}', ${opts});
      })()
    `);
  }

  async getInstalledProtonVersions(): Promise<any[]> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getInstalledProtonVersions();
      })()
    `);
  }

  async getGameLaunchProtonVersion(shop: string, objectId: string): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getGameLaunchProtonVersion('${shop}', '${objectId}');
      })()
    `);
  }

  /* ==================== EXTRACTION ==================== */

  async extractGameDownload(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.extractGameDownload('${shop}', '${objectId}');
      })()
    `);
  }

  async getGameInstallerActionType(shop: string, objectId: string): Promise<string | null> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getGameInstallerActionType('${shop}', '${objectId}');
      })()
    `);
  }

  async openGameInstaller(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.openGameInstaller('${shop}', '${objectId}');
      })()
    `);
  }

  /* ==================== LIBRARY MANAGEMENT ==================== */

  async removeGameFromLibrary(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.removeGameFromLibrary('${shop}', '${objectId}');
      })()
    `);
  }

  async deleteGameFolder(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.deleteGameFolder('${shop}', '${objectId}');
      })()
    `);
  }

  async getGameByObjectId(shop: string, objectId: string): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getGameByObjectId('${shop}', '${objectId}');
      })()
    `);
  }

  async addGameToLibrary(shop: string, objectId: string, title: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.addGameToLibrary('${shop}', '${objectId}', '${title.replace(/'/g, "\\'")}');
      })()
    `);
  }

  async addCustomGameToLibrary(params: {
    title: string;
    executablePath: string;
    iconUrl?: string;
    logoImageUrl?: string;
    libraryHeroImageUrl?: string;
  }): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        return await window.electron.addCustomGameToLibrary(
          '${params.title.replace(/'/g, "\\'")}',
          '${params.executablePath}',
          ${params.iconUrl ? `'${params.iconUrl}'` : 'undefined'},
          ${params.logoImageUrl ? `'${params.logoImageUrl}'` : 'undefined'},
          ${params.libraryHeroImageUrl ? `'${params.libraryHeroImageUrl}'` : 'undefined'}
        );
      })()
    `);
  }

  async addGameToFavorites(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.addGameToFavorites('${shop}', '${objectId}');
      })()
    `);
  }

  async removeGameFromFavorites(shop: string, objectId: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.removeGameFromFavorites('${shop}', '${objectId}');
      })()
    `);
  }

  async toggleGamePin(shop: string, objectId: string, pinned: boolean): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.toggleGamePin('${shop}', '${objectId}', ${pinned});
      })()
    `);
  }

  async assignGameToCollection(shop: string, objectId: string, collectionIds: string[]): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.assignGameToCollection('${shop}', '${objectId}', ${JSON.stringify(collectionIds)});
      })()
    `);
  }

  async scanInstalledGames(): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.scanInstalledGames();
      })()
    `);
  }

  /* ==================== CATALOGUE ==================== */

  async getRandomGame(): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getRandomGame();
      })()
    `);
  }

  async getGameStats(shop: string, objectId: string): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getGameStats('${objectId}', '${shop}');
      })()
    `);
  }

  async getGameShopDetails(shop: string, objectId: string, language: string = 'en'): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getGameShopDetails('${objectId}', '${shop}', '${language}');
      })()
    `);
  }

  async getGameAssets(shop: string, objectId: string): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getGameAssets('${objectId}', '${shop}');
      })()
    `);
  }

  async getUnlockedAchievements(shop: string, objectId: string): Promise<any[]> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getUnlockedAchievements('${objectId}', '${shop}');
      })()
    `);
  }

  /* ==================== HARDWARE ==================== */

  async getDiskFreeSpace(path: string): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getDiskFreeSpace('${path}');
      })()
    `);
  }

  async checkFolderWritePermission(path: string): Promise<boolean> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.checkFolderWritePermission('${path}');
      })()
    `);
  }

  async getAvailableDrives(): Promise<any[]> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getAvailableDrives();
      })()
    `);
  }

  /* ==================== GAME TRANSFER ==================== */

  async transferGameFiles(shop: string, objectId: string, destParent: string): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.transferGameFiles('${shop}', '${objectId}', '${destParent}');
      })()
    `);
  }

  /* ==================== SETTINGS ==================== */

  async updateUserPreferences(preferences: Record<string, any>): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.updateUserPreferences(${JSON.stringify(preferences)});
      })()
    `);
  }

  async getDefaultDownloadsPath(): Promise<string> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getDefaultDownloadsPath();
      })()
    `);
  }

  /* ==================== DOWNLOAD SOURCES ==================== */

  async addDownloadSource(url: string): Promise<void> {
    const result = await this.cdp.evaluate(`
      (async () => {
        return await window.electron.addDownloadSource('${url}');
      })()
    `);
    if (result && result.ok === false) {
      throw new Error(result.error || 'Failed to add download source');
    }
  }

  async removeDownloadSource(url: string, removeAll?: boolean): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.removeDownloadSource('${url}', ${removeAll === true ? 'true' : 'false'});
      })()
    `);
  }

  async syncDownloadSources(): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.syncDownloadSources();
      })()
    `);
  }

  /* ==================== LEVELDB DIRECT ACCESS ==================== */

  async leveldbGet(key: string, sublevelName?: string): Promise<any> {
    const sl = sublevelName ? `'${sublevelName}'` : 'null';
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.leveldb.get('${key}', ${sl}, 'json');
      })()
    `);
  }

  async leveldbPut(key: string, value: any, sublevelName?: string): Promise<void> {
    const sl = sublevelName ? `'${sublevelName}'` : 'null';
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.leveldb.put('${key}', ${JSON.stringify(value)}, ${sl}, 'json');
      })()
    `);
  }

  async leveldbDel(key: string, sublevelName?: string): Promise<void> {
    const sl = sublevelName ? `'${sublevelName}'` : 'null';
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.leveldb.del('${key}', ${sl});
      })()
    `);
  }

  async leveldbValues(sublevelName: string): Promise<any[]> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.leveldb.values('${sublevelName}');
      })()
    `);
  }

  /* ==================== SHORTCUTS ==================== */

  async createGameShortcut(shop: string, objectId: string, location: 'desktop' | 'startmenu'): Promise<void> {
    await this.cdp.evaluate(`
      (async () => {
        await window.electron.createGameShortcut('${shop}', '${objectId}', '${location}');
      })()
    `);
  }

  /* ==================== AUTH ==================== */

  async getAuth(): Promise<any> {
    return await this.cdp.evaluate(`
      (async () => {
        return await window.electron.getAuth();
      })()
    `);
  }
}
