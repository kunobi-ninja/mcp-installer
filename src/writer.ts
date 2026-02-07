import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface ServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface WriteResult {
  path: string;
  action: 'created' | 'updated';
}

export interface RemoveResult {
  path: string;
  action: 'removed' | 'not_found' | 'file_missing';
}

// ── JSON ─────────────────────────────────────────────────────────────────────

export function writeJsonConfig(
  path: string,
  serverKey: string,
  name: string,
  entry: ServerEntry,
): WriteResult {
  mkdirSync(dirname(path), { recursive: true });

  let config: Record<string, unknown> = {};
  const existed = existsSync(path);
  if (existed) {
    const raw = readFileSync(path, 'utf8').trim();
    if (raw) config = JSON.parse(raw) as Record<string, unknown>;
  }

  const servers = (config[serverKey] ?? {}) as Record<string, unknown>;
  servers[name] = entry;
  config[serverKey] = servers;

  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return { path, action: existed ? 'updated' : 'created' };
}

export function removeJsonConfig(
  path: string,
  serverKey: string,
  name: string,
): RemoveResult {
  if (!existsSync(path)) return { path, action: 'file_missing' };

  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return { path, action: 'not_found' };

  const config = JSON.parse(raw) as Record<string, unknown>;
  const servers = config[serverKey] as Record<string, unknown> | undefined;
  if (!servers || !(name in servers)) return { path, action: 'not_found' };

  delete servers[name];
  if (Object.keys(servers).length === 0) {
    delete config[serverKey];
  } else {
    config[serverKey] = servers;
  }

  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return { path, action: 'removed' };
}

// ── TOML ─────────────────────────────────────────────────────────────────────

function tomlValue(v: unknown): string {
  if (typeof v === 'string')
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (Array.isArray(v))
    return `[${v.map((item) => tomlValue(item)).join(', ')}]`;
  return String(v);
}

function buildTomlSection(name: string, entry: ServerEntry): string {
  const lines = [`[mcp_servers.${name}]`];
  lines.push(`command = ${tomlValue(entry.command)}`);
  lines.push(`args = ${tomlValue(entry.args)}`);
  if (entry.env) {
    lines.push('');
    lines.push(`[mcp_servers.${name}.env]`);
    for (const [k, v] of Object.entries(entry.env)) {
      lines.push(`${k} = ${tomlValue(v)}`);
    }
  }
  return lines.join('\n');
}

export function writeTomlConfig(
  path: string,
  name: string,
  entry: ServerEntry,
): WriteResult {
  mkdirSync(dirname(path), { recursive: true });

  const existed = existsSync(path);
  let content = existed ? readFileSync(path, 'utf8') : '';
  const section = buildTomlSection(name, entry);

  // Match [mcp_servers.<name>] through to the next top-level section header or EOF
  const sectionRegex = new RegExp(
    `\\[mcp_servers\\.${escapeRegex(name)}\\].*?(?=\\n\\[(?!mcp_servers\\.${escapeRegex(name)})|$)`,
    's',
  );

  if (sectionRegex.test(content)) {
    content = content.replace(sectionRegex, `${section}\n`);
  } else {
    content = content.trimEnd();
    content = content ? `${content}\n\n${section}\n` : `${section}\n`;
  }

  writeFileSync(path, content);
  return { path, action: existed ? 'updated' : 'created' };
}

export function removeTomlConfig(path: string, name: string): RemoveResult {
  if (!existsSync(path)) return { path, action: 'file_missing' };

  const content = readFileSync(path, 'utf8');

  const sectionRegex = new RegExp(
    `\\n?\\[mcp_servers\\.${escapeRegex(name)}\\].*?(?=\\n\\[(?!mcp_servers\\.${escapeRegex(name)})|$)`,
    's',
  );

  if (!sectionRegex.test(content)) return { path, action: 'not_found' };

  const updated = content
    .replace(sectionRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  writeFileSync(path, updated ? `${updated}\n` : '');
  return { path, action: 'removed' };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
