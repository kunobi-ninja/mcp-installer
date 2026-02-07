import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export interface ClientDef {
  /** Display name shown in prompts */
  name: string;
  /** Config file format */
  format: 'json' | 'toml';
  /** Top-level key that holds server entries */
  serverKey: string;
  /** Path to project-scoped config file (relative to cwd), or null if unsupported */
  projectPath: ((cwd: string) => string) | null;
  /** Path to user-scoped config file, or null if unsupported */
  userPath: (() => string) | null;
  /** Returns true if the client appears to be installed */
  detectInstalled: () => boolean;
}

const home = homedir();
const os = platform();

function claudeDesktopUserPath(): string {
  if (os === 'darwin')
    return join(
      home,
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    );
  if (os === 'win32')
    return join(
      process.env.APPDATA || join(home, 'AppData', 'Roaming'),
      'Claude',
      'claude_desktop_config.json',
    );
  // Linux
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

function codexHome(): string {
  return process.env.CODEX_HOME || join(home, '.codex');
}

export const CLIENTS: ClientDef[] = [
  {
    name: 'Claude Code',
    format: 'json',
    serverKey: 'mcpServers',
    projectPath: (cwd) => join(cwd, '.mcp.json'),
    userPath: () =>
      join(process.env.CLAUDE_CONFIG_DIR || join(home, '.claude'), '.mcp.json'),
    detectInstalled: () =>
      existsSync(process.env.CLAUDE_CONFIG_DIR || join(home, '.claude')),
  },
  {
    name: 'Claude Desktop',
    format: 'json',
    serverKey: 'mcpServers',
    projectPath: null,
    userPath: claudeDesktopUserPath,
    detectInstalled: () => {
      if (os === 'darwin')
        return existsSync(
          join(home, 'Library', 'Application Support', 'Claude'),
        );
      if (os === 'win32')
        return existsSync(
          join(
            process.env.APPDATA || join(home, 'AppData', 'Roaming'),
            'Claude',
          ),
        );
      return existsSync(join(home, '.config', 'Claude'));
    },
  },
  {
    name: 'Cursor',
    format: 'json',
    serverKey: 'mcpServers',
    projectPath: (cwd) => join(cwd, '.cursor', 'mcp.json'),
    userPath: () => join(home, '.cursor', 'mcp.json'),
    detectInstalled: () => existsSync(join(home, '.cursor')),
  },
  {
    name: 'Windsurf',
    format: 'json',
    serverKey: 'mcpServers',
    projectPath: (cwd) => join(cwd, '.windsurf', 'mcp.json'),
    userPath: () => join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    detectInstalled: () => existsSync(join(home, '.codeium', 'windsurf')),
  },
  {
    name: 'Gemini CLI',
    format: 'json',
    serverKey: 'mcpServers',
    projectPath: (cwd) => join(cwd, '.gemini', 'settings.json'),
    userPath: () => join(home, '.gemini', 'settings.json'),
    detectInstalled: () => existsSync(join(home, '.gemini')),
  },
  {
    name: 'Codex CLI',
    format: 'toml',
    serverKey: 'mcp_servers',
    projectPath: (cwd) => join(cwd, '.codex', 'config.toml'),
    userPath: () => join(codexHome(), 'config.toml'),
    detectInstalled: () => existsSync(codexHome()),
  },
];
