import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKER = join(REPO, 'scripts/check-vi.mjs');
const temporaryRoots = [];

function write(root, path, contents) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function fixture(source = 'export const clean = true;\n') {
  const root = mkdtempSync(join(tmpdir(), 'sw-vi-'));
  temporaryRoots.push(root);
  for (const app of ['storefront-web', 'admin-web', 'auth-web']) {
    write(root, `apps/${app}/src/App.tsx`, app === 'storefront-web' ? source : 'export const clean = true;\n');
  }
  write(root, 'packages/design-system/src/tokens.json', `${JSON.stringify({ radius: { small: 8, medium: 12, large: 16, extraLarge: 24 } })}\n`);
  write(root, 'packages/design-system/src/tokens.css', 'fresh\n');
  write(
    root,
    'scripts/build-web-tokens.mjs',
    `import { readFileSync } from 'node:fs';
import { join } from 'node:path';
if (!process.argv.includes('--check')) throw new Error('fixture only supports --check');
if (readFileSync(join(process.cwd(), 'packages/design-system/src/tokens.css'), 'utf8') !== 'fresh\\n') process.exit(1);
`
  );
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [CHECKER, '--project-root', root, '--baseline', 'scripts/vi-baseline.json', ...args], { encoding: 'utf8' });
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function snapshot(root) {
  const result = {};
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const full = join(directory, name);
      if (statSync(full).isDirectory()) walk(full);
      else result[relative(root, full)] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root);
  return result;
}

afterEach(() => {
  while (temporaryRoots.length) rmSync(temporaryRoots.pop(), { recursive: true, force: true });
});

test('baseline counts occurrences and a later hardcoded color increase fails without writing', () => {
  const root = fixture('export const x = <div className="bg-[#123456] text-[#654321]" />;\n');
  assert.equal(run(root, '--update-baseline').status, 0);
  const baselinePath = join(root, 'scripts/vi-baseline.json');
  const before = readFileSync(baselinePath, 'utf8');
  assert.equal(JSON.parse(before).files['apps/storefront-web/src/App.tsx']['hardcoded-color'], 2);

  write(root, 'apps/storefront-web/src/App.tsx', 'export const x = <div className="bg-[#123456] text-[#654321] border-[#ABCDEF]" />;\n');
  const result = run(root, '--check');
  assert.equal(result.status, 1);
  assert.match(output(result), /\[hardcoded-color\]/);
  assert.equal(readFileSync(baselinePath, 'utf8'), before);
});

test('missing baseline never appears during a read-only check', () => {
  const root = fixture();
  const before = snapshot(root);
  const result = run(root, '--check');
  assert.equal(result.status, 1);
  assert.match(output(result), /baseline 不存在/);
  assert.deepEqual(snapshot(root), before);
});

test('read-only check reports a decrease; explicit update lowers the baseline', () => {
  const root = fixture('export const x = <div className="bg-[#123456] text-[#654321]" />;\n');
  assert.equal(run(root, '--update-baseline').status, 0);
  const baselinePath = join(root, 'scripts/vi-baseline.json');
  write(root, 'apps/storefront-web/src/App.tsx', 'export const x = <div className="bg-[#123456]" />;\n');

  const check = run(root, '--check');
  assert.equal(check.status, 0);
  assert.match(output(check), /债务减少 1 处/);
  assert.equal(JSON.parse(readFileSync(baselinePath, 'utf8')).files['apps/storefront-web/src/App.tsx']['hardcoded-color'], 2);
  assert.equal(run(root, '--update-baseline').status, 0);
  assert.equal(JSON.parse(readFileSync(baselinePath, 'utf8')).files['apps/storefront-web/src/App.tsx']['hardcoded-color'], 1);
  assert.equal(run(root, '--check').status, 0);
});

test('a waiver needs a same-line reason; a reasoned waiver works', () => {
  const root = fixture('export const x = <div className="bg-[#123456]" />; // vi-allow: hardcoded-color\n');
  const rejected = run(root, '--update-baseline');
  assert.equal(rejected.status, 1);
  assert.match(output(rejected), /\[waiver-without-reason\]/);

  write(root, 'apps/storefront-web/src/App.tsx', 'export const x = <div className="bg-[#123456]" />; // vi-allow: hardcoded-color — 合同邮件需保留客户色\n');
  assert.equal(run(root, '--update-baseline').status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'scripts/vi-baseline.json'), 'utf8')).files, {});
});

test('every debt rule fails while similar VI-safe code passes', () => {
  const legal = `
const ticket = '工单 #9910';
const url = 'https://example.test/#123456';
const ordinary = 'green-500';
export const x = <div className="bg-[var(--sw-brand)] text-xs font-bold rounded-lg rounded-xl rounded-2xl rounded-3xl rounded-full rounded-[var(--sw-radius-lg)] bg-amber-50 bg-emerald-50" />;
`;
  const root = fixture(legal);
  assert.equal(run(root, '--update-baseline').status, 0);
  assert.equal(run(root, '--check').status, 0);

  write(root, 'apps/storefront-web/src/App.tsx', `${legal}\nexport const bad = <div className="bg-[#123456] text-[11px] font-extrabold rounded-md hover:text-purple-600 dark:bg-orange-50" />;\n`);
  const result = run(root, '--check');
  assert.equal(result.status, 1);
  for (const rule of ['hardcoded-color', 'font-size-floor', 'font-weight-ceiling', 'radius-off-scale', 'palette-drift', 'semantic-duplicate']) {
    assert.match(output(result), new RegExp(`\\[${rule}\\]`));
  }
});

test('check mode is byte-for-byte read-only', () => {
  const root = fixture('export const x = <div className="bg-[#123456]" />;\n');
  assert.equal(run(root, '--update-baseline').status, 0);
  const before = snapshot(root);
  assert.equal(run(root, '--check').status, 0);
  assert.deepEqual(snapshot(root), before);
});

test('a stale generated token file fails and is never repaired', () => {
  const root = fixture();
  assert.equal(run(root, '--update-baseline').status, 0);
  const tokenFile = join(root, 'packages/design-system/src/tokens.css');
  writeFileSync(tokenFile, 'stale\n');
  const result = run(root, '--check');
  assert.equal(result.status, 1);
  assert.match(output(result), /\[stale-generated\]/);
  assert.equal(readFileSync(tokenFile, 'utf8'), 'stale\n');
});
