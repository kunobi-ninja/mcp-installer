import * as p from '@clack/prompts';
import { CLIENTS } from './clients.js';
import {
  removeJsonConfig,
  removeTomlConfig,
  type ServerEntry,
  writeJsonConfig,
  writeTomlConfig,
} from './writer.js';

export type { ClientDef } from './clients.js';
export { CLIENTS } from './clients.js';
export type { ClientConfig, ServerInfo } from './list.js';
export { list } from './list.js';
export type { UpdateInfo } from './update.js';
export { checkForUpdate } from './update.js';

const clientsByName = new Map(CLIENTS.map((c) => [c.name, c]));

export interface McpServerEntry {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

type Scope = 'project' | 'user';

function cancelled(): never {
  p.cancel('Operation cancelled.');
  process.exit(0);
}

// ── Install ──────────────────────────────────────────────────────────────────

export async function install(entry: McpServerEntry): Promise<void> {
  p.intro(`${entry.name} MCP — Install`);

  const scope = await p.select<Scope>({
    message: 'Scope',
    options: [
      { value: 'project', label: 'Project (current directory)' },
      { value: 'user', label: 'User (global)' },
    ],
  });
  if (p.isCancel(scope)) cancelled();

  const detected = CLIENTS.filter((c) => c.detectInstalled());
  const detectedNames = new Set(detected.map((c) => c.name));

  const available = CLIENTS.filter((c) => {
    if (scope === 'project') return c.projectPath !== null;
    return c.userPath !== null;
  });

  if (available.length === 0) {
    p.log.error('No clients support the selected scope.');
    p.outro('Nothing to do.');
    return;
  }

  const selected = await p.multiselect<string>({
    message: `Clients${detected.length > 0 ? ` (detected: ${detected.map((c) => c.name).join(', ')})` : ''}`,
    options: available.map((c) => ({
      value: c.name,
      label: c.name,
      hint: detectedNames.has(c.name) ? 'detected' : undefined,
    })),
    initialValues: available
      .filter((c) => detectedNames.has(c.name))
      .map((c) => c.name),
    required: true,
  });
  if (p.isCancel(selected)) cancelled();

  const cwd = process.cwd();
  const serverEntry: ServerEntry = {
    command: entry.command,
    args: entry.args,
    ...(entry.env && { env: entry.env }),
  };

  for (const clientName of selected) {
    const client = clientsByName.get(clientName);
    if (!client) continue;
    const configPath =
      scope === 'project' ? client.projectPath?.(cwd) : client.userPath?.();
    if (!configPath) continue;

    const result =
      client.format === 'json'
        ? writeJsonConfig(configPath, client.serverKey, entry.name, serverEntry)
        : writeTomlConfig(configPath, entry.name, serverEntry);

    p.log.success(
      `${result.action === 'created' ? 'Wrote' : 'Updated'} ${result.path} (${client.name})`,
    );
  }

  p.outro('Done! Restart your AI client to load the new MCP server.');
}

// ── Uninstall ────────────────────────────────────────────────────────────────

export async function uninstall(
  entry: Pick<McpServerEntry, 'name'>,
): Promise<void> {
  p.intro(`${entry.name} MCP — Uninstall`);

  const scope = await p.select<Scope | 'both'>({
    message: 'Scope',
    options: [
      { value: 'project', label: 'Project (current directory)' },
      { value: 'user', label: 'User (global)' },
      { value: 'both', label: 'Both' },
    ],
  });
  if (p.isCancel(scope)) cancelled();

  const scopes: Scope[] = scope === 'both' ? ['project', 'user'] : [scope];

  const available = CLIENTS.filter((c) => {
    for (const s of scopes) {
      if (s === 'project' && c.projectPath !== null) return true;
      if (s === 'user' && c.userPath !== null) return true;
    }
    return false;
  });

  if (available.length === 0) {
    p.log.error('No clients support the selected scope.');
    p.outro('Nothing to do.');
    return;
  }

  const selected = await p.multiselect<string>({
    message: 'Clients',
    options: available.map((c) => ({
      value: c.name,
      label: c.name,
    })),
    required: true,
  });
  if (p.isCancel(selected)) cancelled();

  const cwd = process.cwd();
  let removedAny = false;

  for (const clientName of selected) {
    const client = clientsByName.get(clientName);
    if (!client) continue;

    for (const s of scopes) {
      const configPath =
        s === 'project' ? client.projectPath?.(cwd) : client.userPath?.();
      if (!configPath) continue;

      const result =
        client.format === 'json'
          ? removeJsonConfig(configPath, client.serverKey, entry.name)
          : removeTomlConfig(configPath, entry.name);

      if (result.action === 'removed') {
        p.log.success(`Removed from ${result.path} (${client.name})`);
        removedAny = true;
      } else if (result.action === 'not_found') {
        p.log.warn(
          `${entry.name} not found in ${result.path} (${client.name})`,
        );
      }
      // file_missing → silently skip
    }
  }

  if (removedAny) {
    p.outro('Done! Restart your AI client to apply changes.');
  } else {
    p.outro('No configurations were modified.');
  }
}
