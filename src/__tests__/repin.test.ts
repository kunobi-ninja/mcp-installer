import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repin } from '../index.js';
import type { ClientConfig } from '../list.js';

let dir: string;

beforeEach(() => {
  dir = join(
    tmpdir(),
    `mcp-installer-repin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const NEW = {
  name: 'kunobi',
  command: 'npx',
  args: ['-y', '@kunobi/mcp@0.0.2'],
};

describe('repin', () => {
  it('re-pins a JSON (Claude Code) config where the server already exists', () => {
    const path = join(dir, 'claude.json');
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          mcpServers: {
            kunobi: { command: 'npx', args: ['-y', '@kunobi/mcp@0.0.1'] },
            other: { command: 'foo', args: [] },
          },
        },
        null,
        2,
      )}\n`,
    );

    const configs: ClientConfig[] = [
      {
        client: 'Claude Code',
        scope: 'user',
        path,
        exists: true,
        servers: [{ name: 'kunobi' }, { name: 'other' }],
      },
    ];

    const results = repin(NEW, { configs });
    expect(results).toEqual([
      { client: 'Claude Code', scope: 'user', path, action: 'updated' },
    ]);

    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.mcpServers.kunobi.args).toEqual(['-y', '@kunobi/mcp@0.0.2']);
    // unrelated server is left untouched
    expect(written.mcpServers.other).toEqual({ command: 'foo', args: [] });
  });

  it('re-pins a TOML (Codex) config', () => {
    const path = join(dir, 'config.toml');
    writeFileSync(
      path,
      '[mcp_servers.kunobi]\ncommand = "npx"\nargs = ["-y", "@kunobi/mcp@0.0.1"]\n',
    );

    const configs: ClientConfig[] = [
      {
        client: 'Codex CLI',
        scope: 'user',
        path,
        exists: true,
        servers: [{ name: 'kunobi' }],
      },
    ];

    const results = repin(NEW, { configs });
    expect(results.map((r) => r.action)).toEqual(['updated']);

    const written = readFileSync(path, 'utf8');
    expect(written).toContain('"@kunobi/mcp@0.0.2"');
    expect(written).not.toContain('@kunobi/mcp@0.0.1');
  });

  it('skips configs that do not already contain the server (never registers anew)', () => {
    const path = join(dir, 'no-kunobi.json');
    const original = `${JSON.stringify(
      { mcpServers: { other: { command: 'foo', args: [] } } },
      null,
      2,
    )}\n`;
    writeFileSync(path, original);

    const configs: ClientConfig[] = [
      {
        client: 'Claude Code',
        scope: 'user',
        path,
        exists: true,
        servers: [{ name: 'other' }],
      },
    ];

    const results = repin(NEW, { configs });
    expect(results).toEqual([]);
    // file untouched
    expect(readFileSync(path, 'utf8')).toBe(original);
  });
});
