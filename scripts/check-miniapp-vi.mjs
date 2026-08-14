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
const GENERATED = ['styles/tokens.wxss', 'styles/icons.wxss', 'data/assets.generated.js', 'data/catalog-taxonomy.generated.js'];
const TEXT_EXTENSIONS = new Set(['js', 'json', 'wxml', 'wxss']);

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

const allFiles = walk(MP).map((full) => ({ full, rel: relative(MP, full).split('\\').join('/') }));
const files = allFiles.filter(({ rel }) => TEXT_EXTENSIONS.has(rel.split('.').pop()));

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
    const colour = code.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\s*\([^)]*\)/i);
    if (colour && !generated) {
      if (extension === 'json') {
        check('untokenized-color', !TOKEN_COLOURS.has(colour[0].toUpperCase()), `${colour[0]} 不在 tokens.json 的调色板内`);
      } else {
        check('hardcoded-color', true, `${colour[0]} — 请改用 var(--sw-*)`);
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
    check('hardcoded-safe-area', /(safe-?top|statusBarHeight|navTotalHeight|capsule\w*)\s*[:=]\s*[1-9]\d*/.test(code) && rel !== 'utils/safeArea.js', '顶部安全区必须来自 wx.getWindowInfo / getMenuButtonBoundingClientRect');

    // Flex gap is unreliable on older WeChat Android base libraries.
    check('flex-gap', /^\s*(row-|column-)?gap:/.test(code), '低版本安卓基础库对 flex gap 支持不稳定，请改用 margin');

    // Tablet rule no-750-absolutes. 750rpx means "the whole screen", which stops
    // being true the moment the tablet content column is capped — anything
    // measured against it overflows the column.
    // calc() may multiply by a var() but may not divide by one. The whole
    // declaration is dropped silently and the layout collapses to auto width —
    // this is what turned the two-column product grid into a half-width column.
    check('calc-divide-var', /\/\s*var\(/.test(code), 'calc() 不能除以 CSS 变量，整条声明会被丢弃；请在生成器里算成字面值');

    check('screen-width-absolute', !generated && /\b750rpx\b/.test(code), '不得以 750rpx 为宽度基准，平板内容列封顶后会溢出；改用百分比或 flex');
  });

  if (generated && !source.startsWith('/* GENERATED')) {
    fail(rel, 1, 'generated-edited', '该文件由 scripts/build-miniapp-assets.mjs 生成，请改生成器');
  }
}

// Compare in memory. A check must never rewrite or "repair" the working tree.
try {
  execFileSync(process.execPath, [join(ROOT, 'scripts/build-miniapp-assets.mjs'), '--check'], { stdio: 'pipe' });
} catch {
  fail('styles/', 1, 'stale-generated', '生成结果与仓库不一致，请运行 npm run build:miniapp-assets 并提交输出');
}

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

/**
 * Icon names supplied by data resolve through templates such as
 * `i-{{item.icon}}-brand`, so the literal scan above cannot see them. A name
 * that never got generated renders as an empty box in the simulator — the exact
 * symptom of the previous builds. Check every data-driven name too.
 */
const DATA_DRIVEN_ICON_FILES = new Set(['data/demo.js', 'custom-tab-bar/index.js']);
for (const { full, rel } of files.filter((f) => DATA_DRIVEN_ICON_FILES.has(f.rel))) {
  const source = stripComments(readFileSync(full, 'utf8'), 'js');
  for (const match of source.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)) {
    if (!iconSheet.includes(`.i-${match[1]}-`)) {
      fail(rel, 1, 'missing-icon', `数据里用了 "${match[1]}"，但它没有生成任何变体 — 会渲染成空白`);
    }
  }
}

/**
 * utils/sizeClass.js has to duplicate the size-class boundaries because the
 * mini program cannot import repository files. Two copies of the same numbers
 * is exactly how tokens.css drifted, so assert they agree.
 */
const platforms = JSON.parse(readFileSync(join(ROOT, 'packages/design-system/src/mobile-platforms.json'), 'utf8'));
const sizeSource = readFileSync(join(MP, 'utils/sizeClass.js'), 'utf8');
for (const cls of platforms.sizeClasses) {
  const bound = cls.maxWidthPt === null ? 'Infinity' : String(cls.maxWidthPt);
  const expected = new RegExp(`key:\\s*'${cls.key}'\\s*,\\s*maxWidthPt:\\s*${bound}\\b`);
  if (!expected.test(sizeSource)) {
    fail('utils/sizeClass.js', 1, 'size-class-drift', `${cls.key} 的边界与 mobile-platforms.json 不一致（应为 ${bound}）`);
  }
}

if (failures.length === 0) {
  console.log(`miniapp VI check passed — ${files.length} source files / ${allFiles.length} total files`);
  process.exit(0);
}

console.error(`miniapp VI check FAILED — ${failures.length} issue(s)\n`);
for (const item of failures) console.error(`  ${item.file}:${item.line}  [${item.rule}]  ${item.detail}`);
process.exit(1);
