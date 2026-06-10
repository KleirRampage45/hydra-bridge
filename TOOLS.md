# Hydra MCP Bridge — Full Tool Reference

> **Session:** 2026-06-09  
> **Bridge:** `~/Development/hydra-bridge/`  
> **Total Tools:** 46 (cleaned from 48 — removed 2 redundant)  
> **Files Modified:** `src/hydra-api.ts`, `src/mcp-server.ts`

---

## Tool Categories

### 1. Search & Catalogue (7 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_search_games` | `hydraApi.post(/catalogue/search)` | Search by title |
| `hydra_get_repacks` | `hydraApi.get(/games/{shop}/{objectId}/download-sources)` | Get download options |
| `hydra_get_random_game` | `getRandomGame()` | Random game from catalogue |
| `hydra_get_game_stats` | `getGameStats()` | Player count, downloads, reviews |
| `hydra_get_game_shop_details` | `getGameShopDetails()` | Steam/other store page data |
| `hydra_get_game_assets` | `getGameAssets()` | Cover art, icons, screenshots |
| `hydra_get_achievements` | `getUnlockedAchievements()` | Unlocked achievements |

### 2. Download Management (7 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_start_download` | `startGameDownload()` | Start new download |
| `hydra_pause_download` | `pauseGameDownload()` | Pause active download |
| `hydra_resume_download` | `resumeGameDownload(strategy?)` | Resume with conflict strategy |
| `hydra_cancel_download` | `cancelGameDownload()` | Cancel active/queued |
| `hydra_get_download_queue` | state + library enrichment | Queue with active/queued/paused details |
| `hydra_reorder_download` | `moveDownloadPlacement()` | Move between hero/queue/paused at index |
| `hydra_add_to_queue` | `addGameToQueue()` | Queue without starting |

### 3. Library (8 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_get_library` | `getLibrary()` | All installed games |
| `hydra_get_game_details` | `getGameByObjectId()` | Single game details |
| `hydra_favorite_game` | `addGameToFavorites/removeGameFromFavorites` | Toggle favorite |
| `hydra_toggle_pin` | `toggleGamePin()` | Pin/unpin |
| `hydra_assign_collection` | `assignGameToCollection()` | Collection assignment |
| `hydra_remove_game` | `removeGameFromLibrary() + deleteGameFolder()` | Remove + optional file delete |
| `hydra_import_game` | `addCustomGameToLibrary()` | Import custom/non-catalogue game |
| `hydra_scan_library` | `scanInstalledGames()` | Rescan for installed games |

### 4. Launch & Proton Config (7 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_launch_game` | Smart: native execFile() or Hydra fallback | Bypasses KIO for native Linux |
| `hydra_set_executable_path` | `updateExecutablePath()` | Set game binary path |
| `hydra_set_proton_path` | `selectGameProtonPath()` | Set Proton version per game |
| `hydra_set_launch_options` | `updateLaunchOptions()` | Launch env vars / CLI flags |
| `hydra_get_proton_versions` | `getInstalledProtonVersions()` | List all installed Proton |
| `hydra_get_game_launch_proton` | `getGameLaunchProtonVersion()` | Which Proton a game uses |
| `hydra_create_shortcut` | `createGameShortcut()` | Desktop/start menu shortcut |

### 5. Extraction (3 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_extract_game` | `extractGameDownload()` | Force re-extraction |
| `hydra_get_installer_action` | `getGameInstallerActionType()` | What installer action is needed |
| `hydra_open_game_installer` | `openGameInstaller()` | Run the installer |

### 6. Settings & Hardware (6 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_get_preferences` | `getUserPreferences()` | User settings |
| `hydra_update_preferences` | `updateUserPreferences()` | Update settings |
| `hydra_get_default_downloads_path` | `getDefaultDownloadsPath()` | System default |
| `hydra_get_disk_free_space` | `getDiskFreeSpace()` | Free space on any path |
| `hydra_get_available_drives` | `getAvailableDrives()` | Partitions/drives |
| `hydra_transfer_game` | `transferGameFiles()` | Move game to another drive |

### 7. Download Sources (4 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_get_download_sources` | `getDownloadSources()` | List sources |
| `hydra_add_download_source` | `addDownloadSource()` | Add source |
| `hydra_remove_download_source` | `removeDownloadSource()` | Remove source |
| `hydra_sync_sources` | `syncDownloadSources()` | Force sync |

### 8. LevelDB Direct Access (2 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_leveldb_get` | `leveldb.get()` | Read any DB key |
| `hydra_leveldb_values` | `leveldb.values()` | List sublevel |

### 9. Auth & Misc (2 tools)
| Tool | IPC Method | Description |
|------|-----------|-------------|
| `hydra_get_auth` | `getAuth()` | Cloud login state |
| `hydra_auto_download` | Compound operation | Search → score → download |

---

## Build & Run

```bash
cd ~/Development/hydra-bridge
npx tsc          # compile
node dist/index.js  # run MCP server on stdio
```

## MCP Config for OpenCode/Claude

```json
{
  "mcpServers": {
    "hydra-bridge": {
      "command": "node",
      "args": ["/home/asukate/Development/hydra-bridge/dist/index.js"]
    }
  }
}
```
