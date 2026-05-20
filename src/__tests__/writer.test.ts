import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  removeJsonConfig,
  removeTomlConfig,
  writeJsonConfig,
  writeTomlConfig,
} from '../writer.js';

let dir: string;

beforeEach(() => {
  dir = join(
    tmpdir(),
    `mcp-installer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ── JSON write ───────────────────────────────────────────────────────────────

describe('writeJsonConfig', () => {
  it('creates new file with server entry', () => {
    const path = join(dir, 'new.json');
    const result = writeJsonConfig(path, 'mcpServers', 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
    });

    expect(result.action).toBe('created');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config).toEqual({
      mcpServers: {
        kunobi: { command: 'npx', args: ['@kunobi/mcp'] },
      },
    });
  });

  it('merges into existing config', () => {
    const path = join(dir, 'existing.json');
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: { other: { command: 'node', args: ['other.js'] } },
        someOtherKey: true,
      }),
    );

    const result = writeJsonConfig(path, 'mcpServers', 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
    });

    expect(result.action).toBe('updated');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config.mcpServers.other).toEqual({
      command: 'node',
      args: ['other.js'],
    });
    expect(config.mcpServers.kunobi).toEqual({
      command: 'npx',
      args: ['@kunobi/mcp'],
    });
    expect(config.someOtherKey).toBe(true);
  });

  it('overwrites existing server entry', () => {
    const path = join(dir, 'overwrite.json');
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: { kunobi: { command: 'old', args: [] } },
      }),
    );

    writeJsonConfig(path, 'mcpServers', 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
    });

    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config.mcpServers.kunobi.command).toBe('npx');
  });

  it('includes env when provided', () => {
    const path = join(dir, 'env.json');
    writeJsonConfig(path, 'mcpServers', 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
      env: { API_KEY: 'secret' },
    });

    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config.mcpServers.kunobi.env).toEqual({ API_KEY: 'secret' });
  });

  it('creates parent directories', () => {
    const path = join(dir, 'deep', 'nested', 'config.json');
    writeJsonConfig(path, 'mcpServers', 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
    });

    expect(existsSync(path)).toBe(true);
  });

  it('writes type and tools fields when present', () => {
    const path = join(dir, 'with-type.json');
    writeJsonConfig(path, 'mcpServers', 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
      type: 'local',
      tools: ['*'],
    });

    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config.mcpServers.kunobi).toEqual({
      command: 'npx',
      args: ['@kunobi/mcp'],
      type: 'local',
      tools: ['*'],
    });
  });

  it('throws a descriptive error when existing JSON is corrupt', () => {
    const path = join(dir, 'corrupt.json');
    writeFileSync(path, '{ not valid json');
    expect(() =>
      writeJsonConfig(path, 'mcpServers', 'kunobi', {
        command: 'npx',
        args: ['@kunobi/mcp'],
      }),
    ).toThrow(/Failed to parse existing config at .*corrupt\.json/);
  });
});

// ── JSON remove ──────────────────────────────────────────────────────────────

describe('removeJsonConfig', () => {
  it('removes server entry and preserves others', () => {
    const path = join(dir, 'remove.json');
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: {
          kunobi: { command: 'npx', args: ['@kunobi/mcp'] },
          other: { command: 'node', args: ['other.js'] },
        },
        otherKey: 42,
      }),
    );

    const result = removeJsonConfig(path, 'mcpServers', 'kunobi');
    expect(result.action).toBe('removed');

    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config.mcpServers).toEqual({
      other: { command: 'node', args: ['other.js'] },
    });
    expect(config.otherKey).toBe(42);
  });

  it('removes empty mcpServers key', () => {
    const path = join(dir, 'remove-empty.json');
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: {
          kunobi: { command: 'npx', args: ['@kunobi/mcp'] },
        },
      }),
    );

    removeJsonConfig(path, 'mcpServers', 'kunobi');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    expect(config.mcpServers).toBeUndefined();
  });

  it('returns not_found when entry does not exist', () => {
    const path = join(dir, 'no-entry.json');
    writeFileSync(path, JSON.stringify({ mcpServers: {} }));

    const result = removeJsonConfig(path, 'mcpServers', 'kunobi');
    expect(result.action).toBe('not_found');
  });

  it('returns file_missing when file does not exist', () => {
    const result = removeJsonConfig(
      join(dir, 'missing.json'),
      'mcpServers',
      'kunobi',
    );
    expect(result.action).toBe('file_missing');
  });

  it('throws a descriptive error when existing JSON is corrupt', () => {
    const path = join(dir, 'corrupt-remove.json');
    writeFileSync(path, '{ not valid json');
    expect(() => removeJsonConfig(path, 'mcpServers', 'kunobi')).toThrow(
      /Failed to parse existing config at .*corrupt-remove\.json/,
    );
  });
});

// ── TOML write ───────────────────────────────────────────────────────────────

describe('writeTomlConfig', () => {
  it('creates new TOML file with server section', () => {
    const path = join(dir, 'new.toml');
    const result = writeTomlConfig(path, 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
    });

    expect(result.action).toBe('created');
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('[mcp_servers.kunobi]');
    expect(content).toContain('command = "npx"');
    expect(content).toContain('args = ["@kunobi/mcp"]');
  });

  it('appends to existing TOML content', () => {
    const path = join(dir, 'existing.toml');
    writeFileSync(path, '[some_other_section]\nkey = "value"\n');

    writeTomlConfig(path, 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
    });

    const content = readFileSync(path, 'utf8');
    expect(content).toContain('[some_other_section]');
    expect(content).toContain('[mcp_servers.kunobi]');
  });

  it('replaces existing server section', () => {
    const path = join(dir, 'replace.toml');
    writeFileSync(path, '[mcp_servers.kunobi]\ncommand = "old"\nargs = []\n');

    writeTomlConfig(path, 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
    });

    const content = readFileSync(path, 'utf8');
    expect(content).not.toContain('command = "old"');
    expect(content).toContain('command = "npx"');
  });

  it('includes env section', () => {
    const path = join(dir, 'env.toml');
    writeTomlConfig(path, 'kunobi', {
      command: 'npx',
      args: ['@kunobi/mcp'],
      env: { API_KEY: 'secret' },
    });

    const content = readFileSync(path, 'utf8');
    expect(content).toContain('[mcp_servers.kunobi.env]');
    expect(content).toContain('API_KEY = "secret"');
  });

  it('throws when entry carries a JSON-only type field', () => {
    const path = join(dir, 'rejected-type.toml');
    expect(() =>
      writeTomlConfig(path, 'kunobi', {
        command: 'npx',
        args: ['@kunobi/mcp'],
        type: 'local',
      }),
    ).toThrow(/TOML writer does not emit/);
  });

  it('throws when entry carries a JSON-only tools field', () => {
    const path = join(dir, 'rejected-tools.toml');
    expect(() =>
      writeTomlConfig(path, 'kunobi', {
        command: 'npx',
        args: ['@kunobi/mcp'],
        tools: ['*'],
      }),
    ).toThrow(/TOML writer does not emit/);
  });
});

// ── TOML remove ──────────────────────────────────────────────────────────────

describe('removeTomlConfig', () => {
  it('removes server section', () => {
    const path = join(dir, 'remove.toml');
    writeFileSync(
      path,
      [
        '[some_section]',
        'key = "value"',
        '',
        '[mcp_servers.kunobi]',
        'command = "npx"',
        'args = ["@kunobi/mcp"]',
        '',
      ].join('\n'),
    );

    const result = removeTomlConfig(path, 'kunobi');
    expect(result.action).toBe('removed');

    const content = readFileSync(path, 'utf8');
    expect(content).toContain('[some_section]');
    expect(content).not.toContain('kunobi');
  });

  it('returns not_found when section does not exist', () => {
    const path = join(dir, 'no-section.toml');
    writeFileSync(path, '[some_section]\nkey = "value"\n');

    const result = removeTomlConfig(path, 'kunobi');
    expect(result.action).toBe('not_found');
  });

  it('returns file_missing when file does not exist', () => {
    const result = removeTomlConfig(join(dir, 'missing.toml'), 'kunobi');
    expect(result.action).toBe('file_missing');
  });
});
