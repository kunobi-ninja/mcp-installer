import { homedir } from 'node:os';
import * as p from '@clack/prompts';
import { install, uninstall } from './index.js';
import { type ClientConfig, list } from './list.js';

const [command, ...rest] = process.argv.slice(2);
const home = homedir();

// ── Formatting helpers ───────────────────────────────────────────────────────

const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;

function tildify(path: string): string {
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function formatCommand(server: {
  command?: string;
  args?: string[];
  type?: string;
  url?: string;
}): string {
  if (server.type === 'http' && server.url) return server.url;
  const parts: string[] = [];
  if (server.command) parts.push(server.command);
  if (server.args?.length) parts.push(...server.args);
  return parts.join(' ') || dim('(no command)');
}

function usage(): void {
  console.log(`@kunobi/mcp-installer — manage MCP server registrations across AI clients

Usage:
  mcp-installer list                             Show all registered MCP servers
  mcp-installer install <name> <command> [args]  Register an MCP server
  mcp-installer uninstall <name>                 Remove an MCP server

Examples:
  mcp-installer list
  mcp-installer install kunobi npx @kunobi/mcp
  mcp-installer uninstall kunobi`);
}

// ── List ─────────────────────────────────────────────────────────────────────

function printScope(label: string, entries: ClientConfig[]): void {
  const withServers = entries.filter((c) => c.servers.length > 0);
  if (withServers.length === 0) return;

  console.log(`\n${bold(label)}`);

  for (const config of withServers) {
    console.log(`\n  ${cyan(config.client)}  ${dim(tildify(config.path))}`);

    const servers = config.servers;
    const maxName = Math.max(...servers.map((s) => s.name.length), 0);
    const pad = Math.min(Math.max(maxName + 2, 12), 24);

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      const branch = i === servers.length - 1 ? '└' : '├';
      console.log(
        `  ${dim(branch)} ${server.name.padEnd(pad)} ${dim(formatCommand(server))}`,
      );
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }

  switch (command) {
    case 'list': {
      const configs = list();
      const project = configs.filter((c) => c.scope === 'project');
      const user = configs.filter((c) => c.scope === 'user');

      printScope('Project', project);
      printScope('User', user);

      const total = configs.reduce((sum, c) => sum + c.servers.length, 0);
      if (total === 0) {
        console.log('\nNo MCP servers found in any client config.');
      }
      console.log();
      break;
    }

    case 'install': {
      const [name, cmd, ...args] = rest;
      if (!name || !cmd) {
        p.log.error('Missing arguments: install <name> <command> [args...]');
        usage();
        process.exit(1);
      }
      await install({ name, command: cmd, args });
      break;
    }

    case 'uninstall': {
      const [name] = rest;
      if (!name) {
        p.log.error('Missing argument: uninstall <name>');
        usage();
        process.exit(1);
      }
      await uninstall({ name });
      break;
    }

    default:
      p.log.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
