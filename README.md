# changedetection-mcp

An [MCP](https://modelcontextprotocol.io) server for [changedetection.io](https://changedetection.io) — control your instance directly from any MCP-compatible AI client.

## Tools

| Tool | Description |
|------|-------------|
| `get_system_info` | System status, uptime, version |
| `list_watches` | List all watches, optionally filtered by tag |
| `create_watch` | Create a new page monitor |
| `get_watch` | Get full details for a watch |
| `update_watch` | Update any watch field |
| `delete_watch` | Delete a watch and its history |
| `set_watch_state` | Pause/unpause or mute/unmute |
| `get_watch_history` | List historical snapshots |
| `get_watch_snapshot` | Get snapshot content |
| `get_watch_diff` | Diff two snapshots |
| `search_watches` | Search by URL or title |
| `list_tags` | List all tags |
| `create_tag` | Create a tag |
| `update_tag` | Update a tag |
| `delete_tag` | Delete a tag |
| `get_notifications` | Get global notification URLs |
| `add_notifications` | Append to global notification list |
| `replace_notifications` | Replace global notification list |
| `import_watches` | Bulk-import URLs |
| `send_test_notification` | Fire a test notification |

## Setup

```bash
pnpm install
```

Set environment variables:

```
CHANGEDETECTION_URL=http://localhost:5000
CHANGEDETECTION_API_KEY=your-api-key
```

## MCP config

```json
{
  "mcpServers": {
    "changedetection": {
      "command": "node",
      "args": ["--experimental-strip-types", "/path/to/changedetection-mcp/src/server.ts"],
      "env": {
        "CHANGEDETECTION_URL": "http://localhost:5000",
        "CHANGEDETECTION_API_KEY": "your-api-key"
      }
    }
  }
}
```
