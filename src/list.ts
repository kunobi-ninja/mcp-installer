import { existsSync, readFileSync } from 'node:fs';
import { CLIENTS } from './clients.js';

export interface ServerInfo {
  name: string;
  command?: string;
  args?: string[];
  type?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ClientConfig {
  client: string;
  scope: 'project' | 'user';
  path: string;
  exists: boolean;
  servers: ServerInfo[];
}

function readJsonServers(path: string, serverKey: string): ServerInfo[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return [];
  try {
    const config = JSON.parse(raw) as Record<string, unknown>;
    const servers = config[serverKey] as Record<string, unknown> | undefined;
    if (!servers || typeof servers !== 'object') return [];
    return Object.entries(servers).map(([name, value]) => ({
      name,
      ...(typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {}),
    }));
  } catch {
    return [];
  }
}

function readTomlServers(path: string): ServerInfo[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf8');
  const results: ServerInfo[] = [];

  // Match [mcp_servers.<name>] sections
  const sectionRegex = /^\[mcp_servers\.([^\].]+)\]/gm;
  let match = sectionRegex.exec(content);
  while (match) {
    const name = match[1];
    const sectionStart = match.index + match[0].length;
    // Find next top-level section or EOF
    const nextSection = content
      .slice(sectionStart)
      .search(/\n\[(?!mcp_servers\.)/);
    const sectionBody =
      nextSection === -1
        ? content.slice(sectionStart)
        : content.slice(sectionStart, sectionStart + nextSection);

    const entry: ServerInfo = { name };
    const commandMatch = sectionBody.match(/^command\s*=\s*"([^"]*)"/m);
    if (commandMatch) entry.command = commandMatch[1];
    const argsMatch = sectionBody.match(/^args\s*=\s*\[([^\]]*)\]/m);
    if (argsMatch) {
      entry.args = argsMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }
    results.push(entry);
    match = sectionRegex.exec(content);
  }

  return results;
}

export function list(cwd?: string): ClientConfig[] {
  const dir = cwd ?? process.cwd();
  const configs: ClientConfig[] = [];

  for (const client of CLIENTS) {
    // Project scope
    if (client.projectPath) {
      const path = client.projectPath(dir);
      const servers =
        client.format === 'json'
          ? readJsonServers(path, client.serverKey)
          : readTomlServers(path);
      configs.push({
        client: client.name,
        scope: 'project',
        path,
        exists: existsSync(path),
        servers,
      });
    }

    // User scope
    if (client.userPath) {
      const path = client.userPath();
      const servers =
        client.format === 'json'
          ? readJsonServers(path, client.serverKey)
          : readTomlServers(path);
      configs.push({
        client: client.name,
        scope: 'user',
        path,
        exists: existsSync(path),
        servers,
      });
    }
  }

  return configs;
}
