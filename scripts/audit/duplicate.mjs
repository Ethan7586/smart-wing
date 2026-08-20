/**
 * Duplicate logic and configuration audit (重复逻辑和配置检查).
 *
 * Reports:
 *   1. catalog    the same domain constant table declared in more than one module
 *   2. block      an identical normalised statement block repeated across files
 *   3. config     the same configuration key defined in more than one place
 *   4. router     more than one module claiming to own HTTP route dispatch
 *   5. envelope   more than one implementation of the API error envelope
 */
import { createHash } from 'node:crypto';
import { sourceFiles, read, rel, walk, ROOT } from './workspace.mjs';
import { extname } from 'node:path';

const MIN_BLOCK_LINES = 8;

function normalise(line) {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function auditBlocks(files) {
  const seen = new Map();
  const findings = [];
  for (const file of files) {
    if (rel(file).includes('.test.')) continue;
    const lines = read(file)
      .split('\n')
      .map(normalise)
      .filter((line) => line.length > 0 && line !== '}' && line !== '{');
    for (let index = 0; index + MIN_BLOCK_LINES <= lines.length; index += 1) {
      const block = lines.slice(index, index + MIN_BLOCK_LINES).join('\n');
      if (block.length < 240) continue;
      const digest = createHash('sha1').update(block).digest('hex');
      if (!seen.has(digest)) {
        seen.set(digest, { file: rel(file), line: index + 1, count: 1, files: new Set([rel(file)]) });
      } else {
        const entry = seen.get(digest);
        entry.count += 1;
        entry.files.add(rel(file));
      }
    }
  }
  for (const entry of seen.values()) {
    if (entry.files.size > 1) {
      findings.push({ kind: 'block', file: [...entry.files].join(' | '), detail: `identical ${MIN_BLOCK_LINES}-line block x${entry.files.size}` });
    }
  }
  return findings;
}

/** Domain constant tables that must have exactly one owner. */
const SINGLE_OWNER_SYMBOLS = [
  { symbol: 'PERMISSIONS', owner: 'packages/authz' },
  { symbol: 'PERMISSION_CATALOG', owner: 'packages/authz' },
  { symbol: 'SCOPE', owner: 'packages/authz' },
  { symbol: 'ERROR_MESSAGES', owner: 'services' },
  { symbol: 'KNOWN_ERRORS', owner: 'services' },
];

function auditSingleOwner(files) {
  const findings = [];
  for (const { symbol, owner } of SINGLE_OWNER_SYMBOLS) {
    const declaration = new RegExp(`export\\s+const\\s+${symbol}\\b`);
    const owners = files.filter((file) => !rel(file).includes('.test.') && declaration.test(read(file))).map(rel);
    if (owners.length > 1) {
      findings.push({ kind: 'catalog', file: owners.join(' | '), detail: `${symbol} declared ${owners.length}x, single owner must be ${owner}` });
    }
  }
  return findings;
}

function auditRouterOwnership(files) {
  const findings = [];
  const routers = files
    .filter((file) => {
      const path = rel(file);
      if (!path.startsWith('services/') || path.includes('.test.')) return false;
      const source = read(file);
      // A dispatcher is a file that maps request paths onto handlers.
      return /\/api\/v1/.test(source) && /(switch\s*\(\s*pathname|url\.pathname\s*===|pathname\s*===)/.test(source);
    })
    .map(rel);
  if (routers.length > 1) {
    findings.push({ kind: 'router', file: routers.join(' | '), detail: `${routers.length} parallel route dispatchers; exactly one thin composer allowed` });
  }
  return findings;
}

function auditErrorEnvelope(files) {
  const findings = [];
  const owners = files.filter((file) => !rel(file).includes('.test.') && /error:\s*\{\s*code/.test(read(file))).map(rel);
  if (owners.length > 1) {
    findings.push({ kind: 'envelope', file: owners.join(' | '), detail: `${owners.length} error envelope builders; only ErrorMapper may build it` });
  }
  return findings;
}

const CONFIG_FILES = ['.json', '.toml', '.yml', '.yaml'];
const CONFIG_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SIGNING_KEY', 'PII_ENCRYPTION_KEY', 'APP_ENV', 'AUTH_MODE'];

function auditConfigDuplication() {
  const findings = [];
  const candidates = [];
  for (const file of walk(ROOT)) {
    const path = rel(file);
    if (CONFIG_FILES.includes(extname(file)) || /(^|\/)(\.env|ecosystem|Caddyfile)/.test(path)) candidates.push(file);
  }
  for (const key of CONFIG_KEYS) {
    const owners = candidates.filter((file) => read(file).includes(key)).map(rel);
    if (owners.length > 1) {
      findings.push({ kind: 'config', file: owners.join(' | '), detail: `${key} defined in ${owners.length} places; packages/config must be the only schema` });
    }
  }
  return findings;
}

export function auditDuplicates() {
  const files = sourceFiles();
  return [...auditSingleOwner(files), ...auditRouterOwnership(files), ...auditErrorEnvelope(files), ...auditConfigDuplication(), ...auditBlocks(files)];
}

if (process.argv[1]?.endsWith('duplicate.mjs')) {
  const findings = auditDuplicates();
  const byKind = new Map();
  for (const finding of findings) {
    if (!byKind.has(finding.kind)) byKind.set(finding.kind, []);
    byKind.get(finding.kind).push(finding);
  }
  for (const [kind, group] of [...byKind].sort()) {
    console.log(`\n[${kind}] ${group.length}`);
    for (const finding of group.slice(0, 25)) console.log(`  ${finding.detail}\n    ${finding.file}`);
    if (group.length > 25) console.log(`  ... ${group.length - 25} more`);
  }
  console.log(`\nduplicate findings: ${findings.length}`);
  process.exit(findings.length > 0 ? 1 : 0);
}
