/**
 * Mini program VI guard.
 *
 * Every rule here corresponds to a specific failure recorded in
 * apps/wechat-miniapp/00-新任务从这里开始/06-事故记录与禁止重犯.md. Documentation did
 * not prevent any of them twice over, because a rule that is not in the file
 * being edited does not constrain the edit. This check is in the build.
 *
 * A rule can be waived on a single line with a same-line comment:
 *   vi-allow: <rule> — <reason>
 * A waiver without a reason is itself a failure, so silently opting out is not
 * cheaper than doing it properly.
 *
 * Run: npm run check:miniapp
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MP = join(ROOT, 'apps/wechat-miniapp/miniprogram');
const GENERATED = ['styles/tokens.wxss', 'styles/icons.wxss'];

const tokens = JSON.parse(readFileSync(join(ROOT, 'packages/design-system/src/tokens.json'), 'utf8'));

/** Every colour literal the VI actually sanctions, for config files that cannot use variables. */
const TOKEN_COLOURS = new Set();
(function collect(node) {
  for (const value of Object.values(node)) {
    if (typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value)) TOKEN_COLOURS.add(value.toUpperCase());
    else if (value && typeof value === 'object') collect(value);
  }
})(tokens.color);

const failures = [];
const fail = (file, line, rule, detail) => failures.push({ file, line, rule, detail });

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Blanks comment bodies while preserving line numbering. */
function stripComments(source, extension) {
  const blank = (match) => match.replace(/[^\n]/g, ' ');
  if (extension === 'wxml') return source.replace(/<!--[\s\S]*?-->/g, blank);
  if (extension === 'json') return source;
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
}

const files = walk(MP).map((full) => ({ full, rel: relative(MP, full).split('\\').join('/') }));

for (const { full, rel } of files) {
  const extension = rel.split('.').pop();
  const generated = GENERATED.includes(rel);
  const source = readFileSync(full, 'utf8');
  const rawLines = source.split('\n');
  const codeLines = stripComments(source, extension).split('\n');

  codeLines.forEach((code, index) => {
    const at = index + 1;
    const raw = rawLines[index] || '';

    const waived = (rule) => {
      const match = raw.match(new RegExp(`vi-allow:\\s*${rule}\\s*(.*)`));
      if (!match) return false;
      if (!match[1].replace(/[-—\s*/]/g, '')) {
        fail(rel, at, 'waiver-without-reason', `vi-allow: ${rule} 必须写明理由`);
      }
      return true;
    };

    const check = (rule, condition, detail) => {
      if (condition && !waived(rule)) fail(rel, at, rule, detail);
    };

    // 06 事故 #8 — cover-view is native-rendered and silently drops ::before,
    // gradients, box-shadow and CSS custom properties.
    check('cover-view', /<cover-view|<cover-image/.test(code), '原生层组件会静默丢弃样式，只在覆盖 map/video/canvas 时使用');

    // 06 事故 #3 — hardcoded values instead of tokens. WeChat config JSON cannot
    // reference variables, so there the literal must at least be a real token.
    const hex = code.match(/#[0-9a-fA-F]{3,8}\b/);
    if (hex && !generated) {
      if (extension === 'json') {
        check('untokenized-color', !TOKEN_COLOURS.has(hex[0].toUpperCase()), `${hex[0]} 不在 tokens.json 的调色板内`);
      } else {
        check('hardcoded-color', true, `${hex[0]} — 请改用 var(--sw-*)`);
      }
    }

    // 06 事故 #4 — icons drawn with CSS instead of real assets.
    check('css-drawn-icon', /border-radius:\s*50%/.test(code), 'border-radius:50% 常见于手绘图标，请用 .i-* 或写明理由');
    check('pseudo-element-art', /::(before|after)/.test(code), '伪元素拼图不得用于图标');

    // 02 VI — no emoji or character icons anywhere in the UI.
    check('emoji', /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(code), '禁止 emoji 与字符图标');

    // 02 VI + 冻结决议 8 — the user-facing name is 会员码.
    check('name-drift', /翼码/.test(raw), '用户界面统一显示「会员码」；内部标识符可用 wingCode');

    // 11 微信原生适配 — the top inset must be measured, never assumed. A zero
    // initialiser is fine; a non-zero literal is a hardcoded layout.
    check(
      'hardcoded-safe-area',
      /(safe-?top|statusBarHeight|navTotalHeight|capsule\w*)\s*[:=]\s*[1-9]\d*/.test(code) && rel !== 'utils/safeArea.js',
      '顶部安全区必须来自 wx.getWindowInfo / getMenuButtonBoundingClientRect'
    );

    // Flex gap is unreliable on older WeChat Android base libraries.
    check('flex-gap', /^\s*(row-|column-)?gap:/.test(code), '低版本安卓基础库对 flex gap 支持不稳定，请改用 margin');
  });

  if (generated && !source.startsWith('/* GENERATED')) {
    fail(rel, 1, 'generated-edited', '该文件由 scripts/build-miniapp-assets.mjs 生成，请改生成器');
  }
}

// Regenerating must be a no-op; otherwise the committed assets are stale.
const before = GENERATED.map((rel) => readFileSync(join(MP, rel), 'utf8'));
execFileSync(process.execPath, [join(ROOT, 'scripts/build-miniapp-assets.mjs')], { stdio: 'pipe' });
GENERATED.forEach((rel, index) => {
  if (readFileSync(join(MP, rel), 'utf8') !== before[index]) {
    fail(rel, 1, 'stale-generated', '生成结果与仓库不一致，请提交 npm run build:miniapp-assets 的输出');
  }
});

// Every literal .i-<name>-<role> used in markup must exist in the generated sheet.
const iconSheet = readFileSync(join(MP, 'styles/icons.wxss'), 'utf8');
for (const { full, rel } of files.filter((f) => f.rel.endsWith('.wxml'))) {
  const markup = stripComments(readFileSync(full, 'utf8'), 'wxml');
  for (const match of markup.matchAll(/\bi-([a-z0-9-]+)-(ink|secondary|muted|brand|white|danger|success)\b/g)) {
    if (!iconSheet.includes(`.i-${match[1]}-${match[2]} `)) {
      fail(rel, 1, 'missing-icon', `.i-${match[1]}-${match[2]} 未生成 — 请加入 MANIFEST 后重新构建，不要手绘`);
    }
  }
}

if (failures.length === 0) {
  console.log(`miniapp VI check passed — ${files.length} files`);
  process.exit(0);
}

console.error(`miniapp VI check FAILED — ${failures.length} issue(s)\n`);
for (const item of failures) console.error(`  ${item.file}:${item.line}  [${item.rule}]  ${item.detail}`);
process.exit(1);
