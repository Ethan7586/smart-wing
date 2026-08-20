/**
 * Call-site integrity audit (调用点断裂检查).
 *
 * Reports four classes of breakage:
 *   1. unresolved   relative import that points at no file on disk
 *   2. missing      named binding the target module never exports
 *   3. undeclared   bare package import absent from the owning package.json
 *   4. unreachable  exported HTTP handler that no router or registry references
 *   5. dangling     client API path with no matching server route
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, sourceFiles, read, rel, imports, importedBindings, exportedNames, resolveRelativeImport, workspacePackages } from './workspace.mjs';

const NODE_BUILTINS = new Set([
  'node:fs',
  'node:path',
  'node:crypto',
  'node:url',
  'node:util',
  'node:os',
  'node:child_process',
  'node:stream',
  'node:buffer',
  'node:events',
  'node:http',
  'node:https',
  'node:zlib',
  'node:assert',
  'node:worker_threads',
  'node:timers',
  'node:test',
  'fs',
  'path',
  'crypto',
  'url',
  'util',
  'os',
  'stream',
  'buffer',
  'events',
  'http',
  'https',
  'zlib',
  'assert',
  'child_process',
]);

function packageRootFor(file) {
  const packages = workspacePackages();
  let best = null;
  for (const workspacePackage of packages) {
    const prefix = workspacePackage.dir.split(/[\\/]/).join('/');
    const target = file.split(/[\\/]/).join('/');
    if (target.startsWith(`${prefix}/`) && (!best || prefix.length > best.dir.split(/[\\/]/).join('/').length)) {
      best = workspacePackage;
    }
  }
  return best;
}

function declaredDependencies(workspacePackage) {
  if (!workspacePackage) return null;
  const json = workspacePackage.json ?? {};
  return new Set([...Object.keys(json.dependencies ?? {}), ...Object.keys(json.devDependencies ?? {}), ...Object.keys(json.peerDependencies ?? {}), ...Object.keys(json.optionalDependencies ?? {})]);
}

function rootDependencies() {
  const manifest = join(ROOT, 'package.json');
  if (!existsSync(manifest)) return new Set();
  try {
    const json = JSON.parse(read(manifest));
    return new Set([...Object.keys(json.dependencies ?? {}), ...Object.keys(json.devDependencies ?? {})]);
  } catch {
    return new Set();
  }
}

function packageNameOf(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

export function auditCallGraph() {
  const findings = [];
  const files = sourceFiles();
  const rootDeps = rootDependencies();
  const workspaceNames = new Set(
    workspacePackages()
      .map((entry) => entry.json?.name)
      .filter(Boolean)
  );

  for (const file of files) {
    const source = read(file);
    const seen = new Set();
    for (const specifier of imports(source)) {
      if (seen.has(specifier)) continue;
      seen.add(specifier);

      if (specifier.startsWith('.')) {
        const target = resolveRelativeImport(file, specifier);
        if (!target) {
          findings.push({ kind: 'unresolved', file: rel(file), detail: specifier });
          continue;
        }
        // Asset modules always expose a default through the bundler loader.
        if (/\.(json|css|svg|png|jpg|webp)$/.test(target)) continue;
        const available = exportedNames(read(target));
        if (available.has('*')) continue; // re-export barrel, cannot statically narrow
        for (const binding of importedBindings(source, specifier)) {
          if (!available.has(binding)) {
            findings.push({ kind: 'missing', file: rel(file), detail: `${binding} <- ${specifier}` });
          }
        }
        continue;
      }

      if (specifier.startsWith('node:') || NODE_BUILTINS.has(specifier)) continue;
      const name = packageNameOf(specifier);
      if (workspaceNames.has(name)) continue;
      const owner = packageRootFor(file);
      const declared = declaredDependencies(owner);
      const known = declared ? new Set([...declared, ...rootDeps]) : rootDeps;
      if (!known.has(name)) {
        findings.push({ kind: 'undeclared', file: rel(file), detail: name });
      }
    }
  }

  findings.push(...auditHandlerReachability(files));
  findings.push(...auditClientPaths(files));
  return findings;
}

const HANDLER_PATTERN = /export\s+(?:async\s+)?function\s+(handle[A-Z][A-Za-z0-9]*)/g;

function auditHandlerReachability(files) {
  const findings = [];
  const handlerFiles = files.filter((file) => rel(file).includes('services/') && !rel(file).includes('.test.'));
  const corpus = files
    .filter((file) => !rel(file).includes('.test.'))
    .map((file) => read(file))
    .join('\n');

  for (const file of handlerFiles) {
    const source = read(file);
    HANDLER_PATTERN.lastIndex = 0;
    let match;
    while ((match = HANDLER_PATTERN.exec(source)) !== null) {
      const handler = match[1];
      const references = corpus.split(handler).length - 1;
      // One occurrence is the declaration itself; anything less means nobody wires it.
      if (references <= 1) {
        findings.push({ kind: 'unreachable', file: rel(file), detail: handler });
      }
    }
  }
  return findings;
}

const CLIENT_PATH_PATTERN = /['"`](\/api\/v1\/[A-Za-z0-9/_:${}.-]*)['"`]/g;

function auditClientPaths(files) {
  const findings = [];
  const serverFiles = files.filter((file) => rel(file).startsWith('services/'));
  const serverCorpus = serverFiles.map((file) => read(file)).join('\n');
  const clientFiles = files.filter((file) => rel(file).startsWith('apps/') && !rel(file).includes('.test.'));

  for (const file of clientFiles) {
    const source = read(file);
    CLIENT_PATH_PATTERN.lastIndex = 0;
    const reported = new Set();
    let match;
    while ((match = CLIENT_PATH_PATTERN.exec(source)) !== null) {
      const path = match[1];
      if (reported.has(path)) continue;
      reported.add(path);
      // Compare on the static prefix so `${id}` segments do not create false negatives.
      const stable = path.split('${')[0].replace(/\/$/, '');
      const segment = stable.replace('/api/v1', '');
      if (segment.length < 2) continue;
      if (!serverCorpus.includes(segment)) {
        findings.push({ kind: 'dangling', file: rel(file), detail: path });
      }
    }
  }
  return findings;
}

if (process.argv[1]?.endsWith('callgraph.mjs')) {
  const findings = auditCallGraph();
  const byKind = new Map();
  for (const finding of findings) {
    if (!byKind.has(finding.kind)) byKind.set(finding.kind, []);
    byKind.get(finding.kind).push(finding);
  }
  for (const [kind, group] of [...byKind].sort()) {
    console.log(`\n[${kind}] ${group.length}`);
    for (const finding of group.slice(0, 40)) console.log(`  ${finding.file}  ${finding.detail}`);
    if (group.length > 40) console.log(`  ... ${group.length - 40} more`);
  }
  console.log(`\ncallgraph findings: ${findings.length}`);
  process.exit(findings.length > 0 ? 1 : 0);
}
