/**
 * Web VI debt guard. --update-baseline creates or explicitly updates the debt
 * ledger; --check is read-only for CI. Existing debt may stay or fall, but may
 * never rise without a written reason.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseSource } from './vi-source.mjs';
import { RULES, scanViRules } from './vi-rules.mjs';

const SCRIPT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['apps/storefront-web/src', 'apps/admin-web/src', 'apps/auth-web/src'];
const EXTENSIONS = ['.css', '.js', '.jsx', '.scss', '.ts', '.tsx'];
const EXTENSION_SET = new Set(EXTENSIONS);

function options(argv) {
  const result = { root: SCRIPT_ROOT, baseline: null, check: false, update: false, reason: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') result.check = true;
    else if (arg === '--update-baseline') result.update = true;
    else if (arg === '--project-root') result.root = resolve(argv[++index] || '');
    else if (arg === '--baseline') result.baseline = argv[++index];
    else if (arg === '--reason') result.reason = argv[++index] || '';
    else throw new Error(`未知参数：${arg}`);
  }
  if (result.check && result.update) throw new Error('--check 与 --update-baseline 不能同时使用');
  if (!result.check && !result.update) throw new Error('请选择 --check 或 --update-baseline；检查模式不会隐式写 baseline');
  result.baseline = resolve(result.root, result.baseline || 'scripts/vi-baseline.json');
  return result;
}

function filesIn(directory, output = []) {
  for (const name of readdirSync(directory)) {
    const full = join(directory, name);
    const stats = statSync(full);
    if (stats.isDirectory()) filesIn(full, output);
    else if (EXTENSION_SET.has(extname(name)) && !name.endsWith('.d.ts')) output.push(full);
  }
  return output;
}

function pathOf(root, full) {
  return relative(root, full).split(sep).join('/');
}

function waiverMap(lines, file, absoluteFailures) {
  const waivers = [];
  lines.forEach((raw, index) => {
    for (const match of raw.matchAll(/(?:\/\/|\/\*)\s*vi-allow:\s*([a-z-]+)\s*(.*)/g)) {
      const rule = match[1];
      const reason = match[2]
        .replace(/\*\/.*$/, '')
        .replace(/^[-—:\s]+/, '')
        .trim();
      if (!RULES.includes(rule)) {
        absoluteFailures.push({ file, line: index + 1, rule: 'waiver-unknown-rule', detail: rule });
      } else if (!reason) {
        absoluteFailures.push({ file, line: index + 1, rule: 'waiver-without-reason', detail: `vi-allow: ${rule} 必须写明理由` });
      } else {
        waivers.push({ line: index + 1, rule, used: false });
      }
    }
  });
  return waivers;
}

function stableBaseline(files) {
  const sorted = {};
  for (const file of Object.keys(files).sort()) {
    const rules = {};
    for (const rule of RULES) if (files[file][rule]) rules[rule] = files[file][rule];
    if (Object.keys(rules).length) sorted[file] = rules;
  }
  return { version: 1, roots: ROOTS, extensions: EXTENSIONS, rules: RULES, files: sorted };
}

function writeBaseline(path, baseline) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(baseline, null, 2)}\n`);
  renameSync(temporary, path);
}

function sameSchema(baseline) {
  return (
    baseline?.version === 1 &&
    JSON.stringify(baseline.roots) === JSON.stringify(ROOTS) &&
    JSON.stringify(baseline.extensions) === JSON.stringify(EXTENSIONS) &&
    JSON.stringify(baseline.rules) === JSON.stringify(RULES) &&
    baseline.files &&
    typeof baseline.files === 'object'
  );
}

function compare(current, baseline) {
  const increases = [];
  const decreases = [];
  const names = new Set([...Object.keys(current.files), ...Object.keys(baseline.files)]);
  for (const file of [...names].sort()) {
    for (const rule of RULES) {
      const now = current.files[file]?.[rule] || 0;
      const before = baseline.files[file]?.[rule] || 0;
      if (now > before) increases.push({ file, rule, now, before });
      if (now < before) decreases.push({ file, rule, now, before });
    }
  }
  return { increases, decreases };
}

function totals(baseline, root) {
  const result = Object.fromEntries(RULES.map((rule) => [rule, 0]));
  for (const [file, counts] of Object.entries(baseline.files)) {
    if (!file.startsWith(`${root}/`)) continue;
    for (const rule of RULES) result[rule] += counts[rule] || 0;
  }
  return result;
}

function printTotals(baseline) {
  for (const root of ROOTS) {
    const count = totals(baseline, root);
    console.log(`${root.replace('/src', '')}: ${RULES.map((rule) => `${rule}=${count[rule]}`).join(' · ')}`);
  }
}

let cli;
try {
  cli = options(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const tokenPath = join(cli.root, 'packages/design-system/src/tokens.json');
const tokens = JSON.parse(readFileSync(tokenPath, 'utf8'));
const radiusValues = [tokens.radius.small, tokens.radius.medium, tokens.radius.large, tokens.radius.extraLarge];
const findings = [];
const absoluteFailures = [];
const counts = {};

for (const sourceRoot of ROOTS) {
  const absoluteRoot = join(cli.root, sourceRoot);
  if (!existsSync(absoluteRoot)) throw new Error(`扫描目录不存在：${sourceRoot}`);
  for (const full of filesIn(absoluteRoot)) {
    const file = pathOf(cli.root, full);
    const contexts = analyseSource(readFileSync(full, 'utf8'), extname(full));
    const waivers = waiverMap(contexts.rawLines, file, absoluteFailures);
    const active = scanViRules(contexts, radiusValues).filter((item) => {
      const waiver = waivers.find((entry) => entry.line === item.line && entry.rule === item.rule);
      if (!waiver) return true;
      waiver.used = true;
      return false;
    });
    for (const waiver of waivers.filter((entry) => !entry.used)) {
      absoluteFailures.push({ file, line: waiver.line, rule: 'waiver-without-violation', detail: `vi-allow: ${waiver.rule} 没有对应的同一行违规` });
    }
    for (const item of active) findings.push({ file, ...item });
    for (const item of active) {
      counts[file] ||= {};
      counts[file][item.rule] = (counts[file][item.rule] || 0) + 1;
    }
  }
}

try {
  execFileSync(process.execPath, [join(cli.root, 'scripts/build-web-tokens.mjs'), '--check'], { cwd: cli.root, stdio: 'pipe' });
} catch {
  absoluteFailures.push({ file: 'packages/design-system/src/tokens.css', line: 1, rule: 'stale-generated', detail: '生成物已过期；运行 npm run build:web-tokens' });
}

const current = stableBaseline(counts);
let baseline = null;
if (existsSync(cli.baseline)) {
  try {
    baseline = JSON.parse(readFileSync(cli.baseline, 'utf8'));
  } catch {
    absoluteFailures.push({ file: pathOf(cli.root, cli.baseline), line: 1, rule: 'baseline-invalid', detail: 'baseline 不是有效 JSON' });
  }
}
if (baseline && !sameSchema(baseline)) {
  absoluteFailures.push({ file: pathOf(cli.root, cli.baseline), line: 1, rule: 'baseline-schema', detail: '规则或扫描范围已变化，请审查后重建 baseline' });
}

if (absoluteFailures.length) {
  console.error(`VI check FAILED — ${absoluteFailures.length} 个绝对错误`);
  for (const item of absoluteFailures) console.error(`  ${item.file}:${item.line} [${item.rule}] ${item.detail}`);
  process.exit(1);
}

if (!baseline) {
  if (!cli.update) {
    console.error('VI check FAILED — baseline 不存在；先运行 npm run update:vi-baseline');
    process.exit(1);
  }
  writeBaseline(cli.baseline, current);
  console.log(`VI baseline 已建立：${pathOf(cli.root, cli.baseline)}`);
  printTotals(current);
  process.exit(0);
}

const { increases, decreases } = compare(current, baseline);
if (increases.length && (!cli.update || !cli.reason.trim())) {
  console.error(`VI check FAILED — ${increases.length} 个文件/规则的存量上升`);
  for (const item of increases) {
    console.error(`  ${item.file} [${item.rule}] ${item.before} → ${item.now}`);
    findings
      .filter((finding) => finding.file === item.file && finding.rule === item.rule)
      .slice(0, 5)
      .forEach((finding) => console.error(`    :${finding.line} ${finding.detail}`));
  }
  if (cli.update) console.error('接受上升必须同时提供 --reason "书面理由"；优先使用单行 vi-allow');
  process.exit(1);
}

if (cli.update) {
  writeBaseline(cli.baseline, current);
  console.log(`VI baseline 已更新${cli.reason ? `（${cli.reason}）` : ''}：${decreases.length} 项下降，${increases.length} 项获准上升`);
} else if (decreases.length) {
  const amount = decreases.reduce((sum, item) => sum + item.before - item.now, 0);
  console.log(`VI 债务减少 ${amount} 处；运行 npm run update:vi-baseline 收紧账本（本次检查保持只读）`);
}
printTotals(current);
console.log(`VI check passed — ${findings.length} 处存量均未增加`);
