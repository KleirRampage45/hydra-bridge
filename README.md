# Hydra MCP Bridge

**46 MCP tools to control [Hydra Launcher](https://hydralauncher.com.br/) programmatically — search games, manage downloads, configure Proton, organize your library, and more.**

```
npx hydra-bridge
```

Works with **Claude Desktop**, **Claude Code**, **OpenCode**, **OpenClaw**, **Hermes Agent**, **Cursor**, **VS Code**, **Cline / Roo Code**, **Continue.dev**, and any MCP-compatible agent.

---

## How It Works

Hydra Launcher is an Electron app. Every Electron app exposes a Chrome DevTools Protocol (CDP) port when started with `--remote-debugging-port=9222`. This bridge:

1. Connects to the running Hydra window via CDP
2. Calls `window.electron.*` IPC methods directly — the same ones Hydra's own UI uses
3. Exposes them as **46 MCP tools** over stdio

No reverse engineering, no patching, no API keys. If Hydra is running, this works.

## Prerequisites

- **Hydra Launcher** installed and running (`/opt/Hydra/hydralauncher` or your OS equivalent)
- **Node.js 18+** (for the bridge)

The bridge auto-starts Hydra with the CDP flag if it isn't already running, so you don't need to configure anything special.

---

## Quick Start

```bash
# Install globally
npm install -g hydra-bridge

# Or run directly
npx hydra-bridge
```

That's it. The bridge connects to your running Hydra instance and exposes tools on stdio. Configure it as an MCP server in your agent (see below).

### From Source

```bash
git clone https://github.com/KleirRampage45/hydra-bridge.git
cd hydra-bridge
npm install
npm run build
node dist/index.js
```

---

## Agent Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hydra-bridge": {
      "command": "npx",
      "args": ["hydra-bridge"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add hydra-bridge -- npx hydra-bridge
```

Or in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "hydra-bridge": {
      "command": "npx",
      "args": ["hydra-bridge"]
    }
  }
}
```

### OpenCode

In `~/.config/opencode/opencode.json`:

```json
{
  "mcpServers": {
    "hydra-bridge": {
      "command": "npx",
      "args": ["hydra-bridge"]
    }
  }
}
```

### OpenClaw

```bash
openclaw mcp add hydra-bridge \
  --command npx \
  --arg hydra-bridge
```

Verify it's working:

```bash
openclaw mcp probe hydra-bridge --json
```

### Hermes Agent

In `~/.hermes/config.yaml`:

```yaml
mcpServers:
  hydra-bridge:
    command: npx
    args: ["hydra-bridge"]
```

Restart the gateway:

```bash
systemctl --user restart hermes-gateway
```

### Cursor

In Cursor settings → MCP Servers:

```json
{
  "mcpServers": {
    "hydra-bridge": {
      "command": "npx",
      "args": ["hydra-bridge"]
    }
  }
}
```

### VS Code (via Continue.dev or VS Code Agents)

In `.continuerc.json` or VS Code MCP settings:

```json
{
  "mcpServers": {
    "hydra-bridge": {
      "command": "npx",
      "args": ["hydra-bridge"]
    }
  }
}
```

### Cline / Roo Code

In `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "hydra-bridge": {
      "command": "npx",
      "args": ["hydra-bridge"]
    }
  }
}
```

### Continue.dev

In `config.json`:

```json
{
  "experimental": {
    "mcpServers": {
      "hydra-bridge": {
        "command": "npx",
        "args": ["hydra-bridge"]
      }
    }
  }
}
```

> **Note:** All agents use the same `npx hydra-bridge` invocation. The bridge auto-connects to Hydra and exposes all 46 tools automatically.

---

## Tool Reference

### Search & Catalogue (7 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_search_games` | Search the catalogue by title | "Find Factorio on Hydra" |
| `hydra_get_repacks` | List all download sources for a game | "What repacks are available for Elden Ring?" |
| `hydra_get_random_game` | Get a random game from the catalogue | "Surprise me with something to play" |
| `hydra_get_game_stats` | Player count, download count, rating | "How popular is Baldur's Gate 3 right now?" |
| `hydra_get_game_shop_details` | Full Steam store page data | "Show me the store description and requirements for Cyberpunk" |
| `hydra_get_game_assets` | Cover art, icon, logo, hero URLs | "Download the cover art for this game" |
| `hydra_get_achievements` | List unlocked achievements for a game | "What achievements have I unlocked in Hollow Knight?" |

### Download Management (7 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_start_download` | Start a new download from a repack URI | "Download Factorio with the preinstalled repack" |
| `hydra_pause_download` | Pause an active download | "Pause the Factorio download, I need bandwidth" |
| `hydra_resume_download` | Resume a paused download (with conflict strategy) | "Resume Factorio, interrupt the current download if needed" |
| `hydra_cancel_download` | Cancel an active or queued download | "Cancel the Stardew Valley download, I picked the wrong one" |
| `hydra_get_download_queue` | Full queue state with enriched game info | "What's downloading and what's queued?" |
| `hydra_reorder_download` | Move a download between hero/queue/paused areas | "Move Cyberpunk to the top of the queue" or "Move this to paused" |
| `hydra_add_to_queue` | Queue a download without starting it | "Add Doom to the queue but don't start yet" |

### Library Management (8 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_get_library` | List all installed games | "Show me my library" |
| `hydra_get_game_details` | Full details for one game (executable, Proton, playtime) | "What executable does Factorio use?" |
| `hydra_favorite_game` | Add or remove a game from favorites | "Favorite Hollow Knight" |
| `hydra_toggle_pin` | Pin or unpin a game in the library | "Pin Stardew Valley to the top" |
| `hydra_assign_collection` | Assign a game to collections | "Add all my RPGs to the 'RPG' collection" |
| `hydra_remove_game` | Remove from library (optionally delete files) | "Remove that game I don't play anymore, and delete its files" |
| `hydra_import_game` | Add a custom game by executable path | "I have a GOG copy of Witcher 3, add it to my library" |
| `hydra_scan_library` | Rescan for newly installed games | "I just moved some game folders, scan for changes" |

### Launch & Proton Configuration (7 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_launch_game` | Launch a game (auto-detects native Linux vs Proton) | "Launch Factorio" |
| `hydra_set_executable_path` | Set or clear the game binary path | "The exe is at /home/me/Games/Factorio/bin/x64/factorio" |
| `hydra_set_proton_path` | Set which Proton version a game uses | "Use GE-Proton10-25 for this Windows game" |
| `hydra_set_launch_options` | Set launch flags and environment variables | "Add `--windowed --no-audio` to the launch options" |
| `hydra_get_proton_versions` | List all installed Proton versions | "What Proton versions do I have installed?" |
| `hydra_get_game_launch_proton` | Check which Proton a game would use | "What Proton does Elden Ring launch with?" |
| `hydra_create_shortcut` | Create desktop or start menu shortcut | "Put a Factorio shortcut on my desktop" |

### Extraction (3 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_extract_game` | Force re-extraction of a game archive | "The extraction failed halfway, try again" |
| `hydra_get_installer_action` | Check what action is needed (install vs ready) | "Is this game ready to play or does it need setup?" |
| `hydra_open_game_installer` | Open the game installer to run setup steps | "I need to run the installer for this game" |

### Settings & Hardware (6 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_get_preferences` | Get all Hydra user preferences | "Show me my current Hydra settings" |
| `hydra_update_preferences` | Update Hydra settings | "Change the default download path to /mnt/hdd/Games" |
| `hydra_get_default_downloads_path` | Get the OS default download path | "Where does Hydra save by default?" |
| `hydra_get_disk_free_space` | Check free space on a path | "How much space is left on /home?" |
| `hydra_get_available_drives` | List all drives and partitions | "What drives are available to move games to?" |
| `hydra_transfer_game` | Move installed game to another drive | "Move Cyberpunk from my SSD to the HDD" |

### Download Sources (4 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_get_download_sources` | List configured download sources | "What repack sites do I have set up?" |
| `hydra_add_download_source` | Add a new download source URL | "Add this new repack site" |
| `hydra_remove_download_source` | Remove a download source | "Remove that dead source" |
| `hydra_sync_sources` | Force sync all sources for new repacks | "Check all sources for new repacks now" |

### LevelDB Direct Access (2 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_leveldb_get` | Read any key from Hydra's internal LevelDB | "What's stored in the game entry for Factorio?" |
| `hydra_leveldb_values` | List all keys in a LevelDB sublevel | "Show me every game in the database" |

### Auth & Automation (2 tools)

| Tool | Description | Use Case |
|------|-------------|----------|
| `hydra_get_auth` | Check Hydra Cloud login status | "Am I logged into Hydra Cloud?" |
| `hydra_auto_download` | Fully autonomous: search → score → download | "I want Factorio, figure it out and get it" |

---

## Example Workflows

### "I want to download Factorio, set it up with Proton, and play it"

The agent orchestrates across multiple tools:

```
1. hydra_search_games("Factorio") → find steam:427520
2. hydra_get_repacks("steam", "427520") → find the best repack
3. hydra_start_download(...) → download it
4. hydra_get_download_queue(...) → wait for completion
5. hydra_get_game_details("steam", "427520") → check if executable is set
6. hydra_set_executable_path("steam", "427520", "/path/to/factorio")
7. hydra_launch_game("steam", "427520") → play
```

### "Move Cyberpunk to my HDD to free up SSD space"

```
1. hydra_get_available_drives() → see /mnt/hdd has 800GB free
2. hydra_transfer_game("steam", "1091500", "/mnt/hdd/Games")
3. hydra_get_game_details("steam", "1091500") → verify new path
```

### "Clean up my library"

```
1. hydra_get_library() → list all games
2. hydra_remove_game("steam", "old-game", deleteFiles: true)
3. hydra_scan_library() → refresh
```

### "Set up this Windows game with the right Proton config"

```
1. hydra_get_proton_versions() → see GE-Proton10-25 is installed
2. hydra_set_proton_path("steam", "123456", "/path/to/GE-Proton10-25")
3. hydra_set_launch_options("steam", "123456", "PROTON_USE_WINED3D=1 %command%")
4. hydra_launch_game("steam", "123456") → test it
```

---

## Architecture

```
┌──────────────┐     CDP (9222)     ┌──────────────┐     stdio     ┌──────────┐
│  Hydra       │ ◄───────────────► │  hydra-bridge  │ ◄──────────► │  Agent   │
│  Launcher    │                   │  (MCP Server)  │              │  (Claude,│
│  (Electron)  │                   │                │              │  OpenCode,│
└──────────────┘                   └──────────────┘              │  etc.)   │
                                                                   └──────────┘
```

- **Hydra** runs as a normal desktop app with `--remote-debugging-port=9222`
- **bridge** connects via CDP, calls `window.electron.*` IPC methods
- **Agent** communicates with the bridge via MCP stdio protocol

The bridge auto-starts Hydra if it's not already running, so a typical flow is:

```bash
hydra-bridge &   # starts Hydra + bridge
# Agent connects and starts issuing tool calls
```

## Security

- The CDP port is bound to **localhost only** — not exposed to the network
- The bridge uses Hydra's existing IPC — no API keys needed
- All LevelDB reads are **read-only** from the bridge (no write operations exposed for safety)
- The bridge only calls methods that Hydra's own UI already exposes

## Platform Support

| Platform | Status |
|----------|--------|
| **Linux** | ✅ Fully tested (Arch, KDE Plasma 6) |
| **Windows** | ✅ Should work — Hydra IPC is cross-platform |
| **macOS** | ✅ Should work — same CDP mechanism |

The bridge works wherever Hydra Launcher runs. The CDP port, IPC handler names, and LevelDB schema are consistent across platforms.

## Troubleshooting

**"Cannot connect to Hydra CDP"**
→ Make sure Hydra is running. The bridge waits up to 30s for it to start.
→ Check that port 9222 isn't blocked by a firewall.

**"Downloader failed silently"**
→ The `downloader` parameter is a **numeric enum** (0-13), not a string. Passing `"Torrent"` instead of `1` will silently fail. Use the numeric values from the tool's input schema.

**"KIO blocks launching on KDE"**
→ The bridge's smart launcher (`hydra_launch_game`) detects native ELF binaries and spawns them directly via `child_process.execFile()` — bypassing KIO entirely.

**"Tool returned empty results"**
→ Some Hydra IPC methods require the app to be fully loaded (download sources synced, library scanned). Try `hydra_sync_sources` or `hydra_scan_library` first.

---

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Test against running Hydra
node dist/index.js

# Test specific tools
node -e "
  const { connectToHydra } = require('./dist/hydra-cdp');
  const { HydraAPI } = require('./dist/hydra-api');
  (async () => {
    const cdp = await connectToHydra();
    const api = new HydraAPI(cdp);
    console.log(await api.getInstalledProtonVersions());
    await cdp.close();
  })();
"
```

## Upstream

This bridge is an independent project that uses Hydra Launcher's existing IPC surface. It is not affiliated with or endorsed by the Hydra Launcher project.

- [Hydra Launcher](https://github.com/hydralauncher/hydra) — the game download manager this bridge controls

## License

MIT
