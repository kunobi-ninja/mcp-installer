import * as p from '@clack/prompts';
import { CLIENTS, mergeEntry } from './clients.js';
import { type ClientConfig, list } from './list.js';
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
export { list };
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
  const baseEntry: ServerEntry = {
    command: entry.command,
    args: entry.args,
    ...(entry.env && { env: entry.env }),
  };

  let anyFailed = false;
  for (const clientName of selected) {
    const client = clientsByName.get(clientName);
    if (!client) continue;
    const configPath =
      scope === 'project' ? client.projectPath?.(cwd) : client.userPath?.();
    if (!configPath) continue;

    const finalEntry = mergeEntry(baseEntry, client.entryDefaults);

    try {
      const result =
        client.format === 'json'
          ? writeJsonConfig(
              configPath,
              client.serverKey,
              entry.name,
              finalEntry,
            )
          : writeTomlConfig(configPath, entry.name, finalEntry);

      p.log.success(
        `${result.action === 'created' ? 'Wrote' : 'Updated'} ${result.path} (${client.name})`,
      );
    } catch (err) {
      anyFailed = true;
      const reason = err instanceof Error ? err.message : String(err);
      p.log.error(`Failed to write ${configPath} (${client.name}): ${reason}`);
    }
  }

  if (anyFailed) {
    process.exitCode = 1;
    p.outro('Done with errors. Some configurations were not written.');
  } else {
    p.outro('Done! Restart your AI client to load the new MCP server.');
  }
}

// ── Repin (non-interactive upgrade) ───────────────────────────────────────────

export interface RepinResult {
  client: string;
  scope: Scope;
  path: string;
  action: 'updated' | 'error';
  error?: string;
}

/**
 * Re-pin an already-installed server entry to new command/args, everywhere it is
 * currently registered. Non-interactive — intended for `upgrade` flows that swap
 * a pinned version. Only touches configs that already contain `entry.name`, so it
 * never registers the server somewhere new. Returns one result per config written.
 *
 * `options.configs` lets callers inject configs (tests); defaults to `list(cwd)`.
 */
export function repin(
  entry: McpServerEntry,
  options: { cwd?: string; configs?: ClientConfig[] } = {},
): RepinResult[] {
  const configs = options.configs ?? list(options.cwd);
  const baseEntry: ServerEntry = {
    command: entry.command,
    args: entry.args,
    ...(entry.env && { env: entry.env }),
  };

  const results: RepinResult[] = [];
  for (const cfg of configs) {
    // Only re-pin where this server is already registered.
    if (!cfg.servers.some((s) => s.name === entry.name)) continue;

    const client = clientsByName.get(cfg.client);
    if (!client) continue;

    const finalEntry = mergeEntry(baseEntry, client.entryDefaults);
    try {
      const result =
        client.format === 'json'
          ? writeJsonConfig(cfg.path, client.serverKey, entry.name, finalEntry)
          : writeTomlConfig(cfg.path, entry.name, finalEntry);
      results.push({
        client: client.name,
        scope: cfg.scope,
        path: result.path,
        action: 'updated',
      });
    } catch (err) {
      results.push({
        client: client.name,
        scope: cfg.scope,
        path: cfg.path,
        action: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
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
