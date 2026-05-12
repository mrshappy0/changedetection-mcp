# changedetection-mcp

An [MCP](https://modelcontextprotocol.io) server for [changedetection.io](https://changedetection.io) — control your instance directly from any MCP-compatible AI client (VS Code Copilot, Claude Desktop, Cursor, etc.). No cloning or local build required.

## Quick start

No installation needed. Add the config below to your MCP client and it will be fetched and run automatically via `npx`.

### VS Code (user-level, syncs across machines)

Add to your user-level MCP config (`Preferences: Open User Settings (JSON)` → `mcp` key, or `~/.config/Code/User/mcp.json`):

```json
{
  "servers": {
    "changedetection": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:mrshappy0/changedetection-mcp"],
      "env": {
        "CHANGEDETECTION_URL": "http://your-instance:5000",
        "CHANGEDETECTION_API_KEY": "${input:changedetection-api-key}"
      }
    }
  }
}
```

> The `${input:changedetection-api-key}` variable causes VS Code to prompt for the key once per session, so it never touches disk.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "changedetection": {
      "command": "npx",
      "args": ["-y", "github:mrshappy0/changedetection-mcp"],
      "env": {
        "CHANGEDETECTION_URL": "http://your-instance:5000",
        "CHANGEDETECTION_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `CHANGEDETECTION_URL` | Yes | Base URL of your changedetection.io instance (e.g. `http://192.168.1.100:5000`) |
| `CHANGEDETECTION_API_KEY` | Yes | API key from **Settings → API** in the changedetection.io UI |

---

## Tools

### System

| Tool | Description |
|---|---|
| `get_system_info` | System status, uptime, version, watch count |

### Watch management

| Tool | Description |
|---|---|
| `list_watches` | List all watches, optionally filtered by tag or force-rechecked |
| `search_watches` | Search watches by URL or title |
| `create_watch` | Create a new page monitor with full field support |
| `get_watch` | Get full details for a single watch |
| `update_watch` | Update any field on an existing watch (partial update) |
| `delete_watch` | Delete a watch and all its history |
| `set_watch_state` | Pause/unpause or mute/unmute a watch |
| `import_watches` | Bulk-import a list of URLs as new watches |

### Snapshots & diffs

| Tool | Description |
|---|---|
| `get_watch_history` | List all historical snapshots for a watch |
| `get_watch_snapshot` | Retrieve the content of a specific snapshot |
| `get_watch_diff` | Diff any two snapshots (text, HTML, or markdown) |

### Tags

| Tool | Description |
|---|---|
| `list_tags` | List all tags |
| `create_tag` | Create a new tag |
| `update_tag` | Rename or update a tag |
| `delete_tag` | Delete a tag |

### Notifications

| Tool | Description |
|---|---|
| `get_notifications` | Get the global notification URL list |
| `add_notifications` | Append URLs to the global notification list |
| `replace_notifications` | Replace the entire global notification list |
| `send_test_notification` | Fire a test notification to verify delivery |

---

## Watch fields

Both `create_watch` and `update_watch` support these fields:

| Field | Type | Description |
|---|---|---|
| `url` | string | URL to monitor |
| `title` | string | Human-friendly label |
| `fetch_backend` | enum | `html_requests` (fast, no JS), `html_webdriver` (Selenium), `system` |
| `processor` | enum | `text_json_diff` (general) or `restock_diff` (price/stock tracking) |
| `include_filters` | string[] | CSS/XPath selectors — only monitor matching elements |
| `subtractive_selectors` | string[] | CSS/XPath selectors to **strip** before diffing (great for removing timestamps, ads, etc.) |
| `ignore_text` | string[] | Regex/text patterns to ignore in diffs |
| `trigger_text` | string[] | Only send notification when one of these patterns matches |
| `llm_intent` | string | Plain-English description of what changes should trigger an alert (AI filtering) |
| `conditions` | object[] | Advanced condition rule objects |
| `conditions_match_logic` | enum | `ALL` or `ANY` (default `ALL`) |
| `time_between_check` | object | e.g. `{"hours": 4}` or `{"minutes": 30}` |
| `notification_urls` | string[] | Per-watch [Apprise](https://github.com/caronc/apprise) notification URLs |
| `notification_title` | string | Custom notification title (supports `{{watch_url}}`, etc.) |
| `notification_body` | string | Custom notification body (supports `{{diff}}`, `{{current_snapshot}}`, etc.) |
| `notification_muted` | boolean | Mute notifications for this watch |
| `paused` | boolean | Pause the watch |
| `webdriver_delay` | number | Seconds to wait after page load before capturing |
| `webdriver_js_execute_code` | string | JavaScript to run in the browser before capture |
| `browser_steps` | object[] | Playwright-style automation steps |
| `tags` | string[] | Tag UUIDs to assign |
| `track_ldjson_price_data` | boolean | Enable JSON-LD price extraction |
| `price_change_min` | number | *(restock_diff)* Alert when price drops below this value |
| `price_change_max` | number | *(restock_diff)* Alert when price rises above this value |
| `price_change_threshold_percent` | number | *(restock_diff)* Minimum % change required to trigger alert |

---

## Local development

Requires [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/mrshappy0/changedetection-mcp.git
cd changedetection-mcp
pnpm install
```

Copy and fill in your environment:

```bash
cp .env.example .env   # or create .env manually
```

```
CHANGEDETECTION_URL=http://localhost:5000
CHANGEDETECTION_API_KEY=your-api-key
```

Run the server directly (no build step):

```bash
pnpm dev        # uses tsx for fast iteration
pnpm start      # uses node --experimental-strip-types
```

Build compiled output:

```bash
pnpm build      # outputs to dist/ with shebang injected
```

The `dist/` directory is committed to the repo so that `npx github:mrshappy0/changedetection-mcp` works without requiring a build step on the consumer side.
