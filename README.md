# @kunobi/mcp-installer

Manage MCP server registrations across AI clients. Works as both a **standalone CLI** and a **reusable library** for MCP servers to provide `--install` / `--uninstall` support.

## Supported Clients

All paths are resolved automatically based on the current OS.

| Client | Format | Project scope | User scope (macOS) | User scope (Linux) | User scope (Windows) |
|---|---|---|---|---|---|
| Claude Code | JSON | `.mcp.json` | `~/.claude/.mcp.json` | `~/.claude/.mcp.json` | `~/.claude/.mcp.json` |
| Claude Desktop | JSON | — | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | JSON | `.cursor/mcp.json` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` |
| Windsurf | JSON | `.windsurf/mcp.json` | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | JSON | `.gemini/settings.json` | `~/.gemini/settings.json` | `~/.gemini/settings.json` | `~/.gemini/settings.json` |
| Codex CLI | TOML | `.codex/config.toml` | `~/.codex/config.toml` | `~/.codex/config.toml` | `%CODEX_HOME%/config.toml` |

Environment variable overrides: `CLAUDE_CONFIG_DIR` (Claude Code detection), `CODEX_HOME` (Codex CLI paths).

Installed clients are auto-detected and pre-selected in the prompt.

## CLI

```sh
npx @kunobi/mcp-installer list
npx @kunobi/mcp-installer install <name> <command> [args...]
npx @kunobi/mcp-installer uninstall <name>
```

### `list` — Show all registered MCP servers

```
$ npx @kunobi/mcp-installer list

User scope
  Claude Code (~/.claude/.mcp.json)
    ngage                http https://ngage.int-dev.zondax.io/mcp
    clickup              npx -y mcp-remote https://mcp.clickup.com/mcp
  Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json)
    ngage                npx @zondax/cli@latest mcp proxy --url https://ngage.int-dev.zondax.io/mcp
  Codex CLI (~/.codex/config.toml)
    ngage                npx -y mcp-remote https://mcp.clickup.com/mcp
```

### `install` — Register an MCP server

```sh
npx @kunobi/mcp-installer install kunobi npx @kunobi/mcp
```

Launches an interactive prompt to select scope (project/user) and target clients.

### `uninstall` — Remove an MCP server

```sh
npx @kunobi/mcp-installer uninstall kunobi
```

## Library

```typescript
import { install, uninstall } from '@kunobi/mcp-installer';

// Register your MCP server with AI clients
await install({
  name: 'my-server',
  command: 'npx',
  args: ['@my-org/mcp-server'],
});

// Remove it
await uninstall({ name: 'my-server' });
```

### Integration example

```typescript
#!/usr/bin/env node

const arg = process.argv[2];

if (arg === '--install' || arg === '-i') {
  const { install } = await import('@kunobi/mcp-installer');
  await install({ name: 'my-server', command: 'npx', args: ['@my-org/mcp-server'] });
  process.exit(0);
}

if (arg === '--uninstall' || arg === '-u') {
  const { uninstall } = await import('@kunobi/mcp-installer');
  await uninstall({ name: 'my-server' });
  process.exit(0);
}

// ... start your MCP server
```

### Interactive flow

```
$ npx @my-org/mcp-server --install

  ◆ my-server MCP — Install

◆ Scope
│ ● Project (current directory)
│ ○ User (global)
└

◆ Clients (detected: Claude Code, Cursor)
│ ◻ Claude Code        (detected)
│ ◻ Claude Desktop
│ ◻ Cursor             (detected)
│ ◻ Windsurf
│ ◻ Gemini CLI
│ ◻ Codex CLI
└

◇ Wrote .mcp.json (Claude Code)
◇ Updated ~/.cursor/mcp.json (Cursor)

✔ Done! Restart your AI client to load the new MCP server.
```

## API

### `install(entry: McpServerEntry): Promise<void>`

Interactive prompt that writes the server entry into selected client configs.

### `uninstall(entry: { name: string }): Promise<void>`

Interactive prompt that removes the server entry from selected client configs. Offers a "Both" scope option to clean up project and user configs in one pass.

### `McpServerEntry`

```typescript
interface McpServerEntry {
  name: string;                    // Server name (key in mcpServers)
  command: string;                 // e.g. "npx"
  args: string[];                  // e.g. ["@my-org/mcp-server"]
  env?: Record<string, string>;   // Optional environment variables
}
```

### `list(cwd?: string): ClientConfig[]`

Returns all registered MCP servers across all clients and scopes. Useful for building dashboards or diagnostics.

```typescript
import { list } from '@kunobi/mcp-installer';

for (const config of list()) {
  if (config.servers.length > 0) {
    console.log(`${config.client} (${config.scope}): ${config.servers.map(s => s.name).join(', ')}`);
  }
}
```

### `CLIENTS`

The client registry is exported for advanced use cases:

```typescript
import { CLIENTS } from '@kunobi/mcp-installer';

for (const client of CLIENTS) {
  console.log(client.name, client.detectInstalled());
}
```
