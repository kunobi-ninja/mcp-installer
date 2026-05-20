import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIENTS, type ClientDef } from '../clients.js';

const home = homedir();

function getClient(name: string): ClientDef {
  const client = CLIENTS.find((c) => c.name === name);
  if (!client) throw new Error(`Client "${name}" not found`);
  return client;
}

describe('CLIENTS', () => {
  it('has 7 client definitions', () => {
    expect(CLIENTS).toHaveLength(7);
  });

  it('each client has required fields', () => {
    for (const client of CLIENTS) {
      expect(client.name).toBeTruthy();
      expect(['json', 'toml']).toContain(client.format);
      expect(client.serverKey).toBeTruthy();
      expect(typeof client.detectInstalled).toBe('function');
    }
  });

  it('all names are unique', () => {
    const names = CLIENTS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('only Codex uses TOML format', () => {
    const tomlClients = CLIENTS.filter((c) => c.format === 'toml');
    expect(tomlClients).toHaveLength(1);
    expect(tomlClients[0].name).toBe('Codex CLI');
  });

  it('Claude Desktop has no project path', () => {
    const desktop = getClient('Claude Desktop');
    expect(desktop.projectPath).toBeNull();
  });

  it('GitHub Copilot CLI has no project path (not natively supported)', () => {
    const copilot = getClient('GitHub Copilot CLI');
    expect(copilot.projectPath).toBeNull();
  });

  it('GitHub Copilot CLI carries entryDefaults for type + tools', () => {
    const copilot = getClient('GitHub Copilot CLI');
    expect(copilot.entryDefaults).toEqual({ type: 'local', tools: ['*'] });
  });

  describe('project paths', () => {
    const cwd = '/test/project';

    it('Claude Code → .mcp.json', () => {
      const client = getClient('Claude Code');
      expect(client.projectPath?.(cwd)).toBe(join(cwd, '.mcp.json'));
    });

    it('Cursor → .cursor/mcp.json', () => {
      const client = getClient('Cursor');
      expect(client.projectPath?.(cwd)).toBe(join(cwd, '.cursor', 'mcp.json'));
    });

    it('Windsurf → .windsurf/mcp.json', () => {
      const client = getClient('Windsurf');
      expect(client.projectPath?.(cwd)).toBe(
        join(cwd, '.windsurf', 'mcp.json'),
      );
    });

    it('Gemini CLI → .gemini/settings.json', () => {
      const client = getClient('Gemini CLI');
      expect(client.projectPath?.(cwd)).toBe(
        join(cwd, '.gemini', 'settings.json'),
      );
    });

    it('Codex CLI → .codex/config.toml', () => {
      const client = getClient('Codex CLI');
      expect(client.projectPath?.(cwd)).toBe(
        join(cwd, '.codex', 'config.toml'),
      );
    });
  });

  describe('user paths — additional clients', () => {
    it('GitHub Copilot CLI → ~/.copilot/mcp-config.json by default', () => {
      const prevCopilotHome = process.env.COPILOT_HOME;
      delete process.env.COPILOT_HOME;
      try {
        const client = getClient('GitHub Copilot CLI');
        expect(client.userPath?.()).toBe(
          join(home, '.copilot', 'mcp-config.json'),
        );
      } finally {
        if (prevCopilotHome !== undefined)
          process.env.COPILOT_HOME = prevCopilotHome;
      }
    });

    it('GitHub Copilot CLI honors COPILOT_HOME', () => {
      const prevCopilotHome = process.env.COPILOT_HOME;
      process.env.COPILOT_HOME = '/tmp/custom-copilot';
      try {
        const client = getClient('GitHub Copilot CLI');
        expect(client.userPath?.()).toBe(
          join('/tmp/custom-copilot', 'mcp-config.json'),
        );
      } finally {
        if (prevCopilotHome === undefined) delete process.env.COPILOT_HOME;
        else process.env.COPILOT_HOME = prevCopilotHome;
      }
    });
  });

  describe('user paths', () => {
    it('Claude Code → ~/.claude.json', () => {
      const client = getClient('Claude Code');
      expect(client.userPath?.()).toBe(join(home, '.claude.json'));
    });

    it('Cursor → ~/.cursor/mcp.json', () => {
      const client = getClient('Cursor');
      expect(client.userPath?.()).toBe(join(home, '.cursor', 'mcp.json'));
    });

    it('Windsurf → ~/.codeium/windsurf/mcp_config.json', () => {
      const client = getClient('Windsurf');
      expect(client.userPath?.()).toBe(
        join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      );
    });

    it('Gemini CLI → ~/.gemini/settings.json', () => {
      const client = getClient('Gemini CLI');
      expect(client.userPath?.()).toBe(join(home, '.gemini', 'settings.json'));
    });

    it('Codex CLI → ~/.codex/config.toml', () => {
      const client = getClient('Codex CLI');
      expect(client.userPath?.()).toBe(join(home, '.codex', 'config.toml'));
    });
  });

  describe('detection', () => {
    it('detectInstalled returns a boolean', () => {
      for (const client of CLIENTS) {
        expect(typeof client.detectInstalled()).toBe('boolean');
      }
    });
  });
});
