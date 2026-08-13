/**
 * Smart Wing WeChat mini program asset pipeline.
 *
 * WXSS cannot import repository-level CSS and WeChat's <image> does not render
 * SVG reliably, so every visual constant has to be *generated into* the mini
 * program instead of referenced from it. That gap is exactly what produced the
 * previous two hand-drawn implementations: with no generated asset available,
 * the cheapest path was a CSS-drawn square. This script makes the correct path
 * the cheap one.
 *
 * Sources of truth (never edited here, only read):
 *   packages/design-system/src/tokens.json           numbers and colours
 *   packages/design-system/src/mobile-platforms.json per-platform sizing
 *   packages/design-system/src/brand/*.svg           official brand marks
 *   node_modules/lucide-react                        icon geometry (ISC)
 *
 * Generated (never hand-edited):
 *   apps/wechat-miniapp/miniprogram/styles/tokens.wxss
 *   apps/wechat-miniapp/miniprogram/styles/icons.wxss
 * Run: npm run build:miniapp-assets
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CALIBRATE_MEMBER_CODE_STROKE, ICON_MANIFEST, IMAGE_EXTENSIONS, PARTNER_LOGOS, ROLES as ROLE_PATHS } from './miniapp-asset-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MP = join(ROOT, 'apps/wechat-miniapp/miniprogram');
const OUT = join(MP, 'styles');
const LUCIDE = join(ROOT, 'node_modules/lucide-react/dist/esm/icons');
const BRAND = join(ROOT, 'packages/design-system/src/brand');
const PARTNER_ASSETS = join(MP, 'assets/partners');

const tokens = JSON.parse(readFileSync(join(ROOT, 'packages/design-system/src/tokens.json'), 'utf8'));
const platforms = JSON.parse(readFileSync(join(ROOT, 'packages/design-system/src/mobile-platforms.json'), 'utf8'));
const wechat = platforms.wechatMiniProgram;

function optionalLocalImage(directory, stem, publicDirectory) {
  for (const extension of IMAGE_EXTENSIONS) {
    if (existsSync(join(directory, `${stem}.${extension}`))) {
      return `/${publicDirectory}/${stem}.${extension}`;
    }
  }
  return null;
}

/** The mini program design width is 375pt = 750rpx, so 1pt renders as 2rpx. */
const RPX_PER_PT = 2;
const rpx = (pt) => `${pt * RPX_PER_PT}rpx`;

/**
 * Colour roles used by generated icons. Adding a role here is cheap; drawing an
 * icon by hand is what we are trying to make impossible.
 */
function tokenAt(path) {
  return path.split('.').reduce((value, key) => value[key], tokens.color);
}
const ROLES = Object.fromEntries(Object.entries(ROLE_PATHS).map(([role, path]) => [role, tokenAt(path)]));

function lucideBody(name) {
  const source = readFileSync(join(LUCIDE, `${name}.js`), 'utf8');
  const open = source.indexOf('[', source.indexOf('const __iconNode = ['));
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    if (source[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const literal = source
    .slice(open, end + 1)
    .replace(/(\w+):/g, '"$1":')
    .replace(/'/g, '"');
  return JSON.parse(literal)
    .map(([tag, attributes]) => {
      const pairs = Object.entries(attributes)
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      return `<${tag} ${pairs}/>`;
    })
    .join('');
}

const normaliseText = (value) => value.replace(/\r\n?/g, '\n');
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(normaliseText(svg), 'utf8').toString('base64')}`;

function lucideUri(name, colour) {
  const stroke = tokens.icon.strokeWidth;
  return dataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${lucideBody(name)}</svg>`);
}

/**
 * The brand member-code mark is authored on a 64 grid with stroke 4, which
 * normalises to 1.5 on the 24 grid every other icon uses — visibly lighter when
 * placed in the same tab bar. The source SVG is a protected file and is not
 * edited; the mini program asset is re-rendered at matching optical weight.
 * Set to false to ship the source weight instead.
 */
function memberCodeUri() {
  const source = readFileSync(join(BRAND, 'wing-code-symbol.svg'), 'utf8');
  if (!CALIBRATE_MEMBER_CODE_STROKE) return dataUri(source);
  const matched = tokens.icon.strokeWidth * (64 / 24);
  const matches = source.match(/stroke-width="4"/g) || [];
  if (matches.length !== 1) {
    throw new Error(`wing-code-symbol.svg expected one stroke-width="4", found ${matches.length}`);
  }
  return dataUri(source.replace('stroke-width="4"', `stroke-width="${matched.toFixed(3)}"`));
}

const brandUri = (file) => dataUri(readFileSync(join(BRAND, file), 'utf8'));
const shadow = ({ x, y, blur, color, alpha }) => `${rpx(x)} ${rpx(y)} ${rpx(blur)} rgba(${color.join(', ')}, ${alpha})`;

// ---------------------------------------------------------------- tokens.wxss

const t = tokens;
const tokensWxss = `/* GENERATED by scripts/build-miniapp-assets.mjs — do not edit by hand. */
/* Source of truth: packages/design-system/src/tokens.json v${t.version} */

/* custom-tab-bar renders outside the page node tree, so custom properties
   declared only on \`page\` never reach it — that is one reason the previous
   tab bar lost every colour and shadow. The .sw-tokens hook lets any root
   outside a page opt in. */
page,
.sw-tokens {
  /* brand */
  --sw-brand: ${t.color.brand.primary};
  --sw-brand-hover: ${t.color.brand.primaryHover};
  --sw-brand-dark: ${t.color.brand.dark};
  --sw-brand-ink: ${t.color.brand.ink};
  --sw-brand-light: ${t.color.brand.light};
  --sw-brand-gradient: linear-gradient(135deg, ${t.color.brand.primary} 0%, ${t.color.brand.dark} 100%);

  /* surface */
  --sw-background: ${t.color.surface.background};
  --sw-surface: ${t.color.surface.base};
  --sw-surface-subtle: ${t.color.surface.subtle};
  --sw-border: ${t.color.surface.border};
  --sw-border-strong: ${t.color.surface.borderStrong};

  /* text */
  --sw-text: ${t.color.text.primary};
  --sw-text-secondary: ${t.color.text.secondary};
  --sw-text-muted: ${t.color.text.muted};
  --sw-text-disabled: ${t.color.text.disabled};
  --sw-text-inverse: ${t.color.text.inverse};
  --sw-inverse-faint: rgba(255, 255, 255, ${t.opacity.inverseFaint});
  --sw-inverse-soft: rgba(255, 255, 255, ${t.opacity.inverseSoft});
  --sw-inverse-muted: rgba(255, 255, 255, ${t.opacity.inverseMuted});
  --sw-inverse-label: rgba(255, 255, 255, ${t.opacity.inverseLabel});
  --sw-inverse-strong: rgba(255, 255, 255, ${t.opacity.inverseStrong});

  /* semantic */
  --sw-success: ${t.color.semantic.success};
  --sw-success-strong: ${t.color.semantic.successStrong};
  --sw-success-surface: ${t.color.semantic.successSurface};
  --sw-warning: ${t.color.semantic.warning};
  --sw-warning-strong: ${t.color.semantic.warningStrong};
  --sw-warning-surface: ${t.color.semantic.warningSurface};
  --sw-danger: ${t.color.semantic.danger};
  --sw-danger-strong: ${t.color.semantic.dangerStrong};
  --sw-danger-surface: ${t.color.semantic.dangerSurface};

  /* type */
  --sw-font-cn: ${t.typography.families.chinese};
  --sw-font-num: ${t.typography.families.financial};
${Object.entries(t.typography.styles)
  .map(([name, style]) => `  --sw-fs-${name}: ${rpx(style.size)};\n  --sw-lh-${name}: ${rpx(style.lineHeight)};\n  --sw-fw-${name}: ${style.weight};`)
  .join('\n')}

  /* spacing — token pt values rendered at ${RPX_PER_PT}rpx per pt */
${Object.entries(t.spacing)
  .map(([name, pt]) => `  --sw-space-${name}: ${rpx(pt)};`)
  .join('\n')}
  --sw-page-inset: ${wechat.pageHorizontalInset}rpx;

  /* radius */
${Object.entries(t.radius)
  .filter(([n]) => n !== 'full')
  .map(([name, pt]) => `  --sw-radius-${name}: ${rpx(pt)};`)
  .join('\n')}
  --sw-radius-full: 9999rpx;

  /* icon */
${Object.entries(t.icon.sizes)
  .map(([name, pt]) => `  --sw-icon-${name}: ${rpx(pt)};`)
  .join('\n')}

  /* member code entry — from mobile-platforms.json wechatMiniProgram */
  --sw-membercode-size: ${wechat.wingCodeButtonSize}rpx;
  --sw-membercode-protrusion: ${wechat.wingCodeProtrusion}rpx;
  --sw-touch-min: ${wechat.minimumTouchTarget}rpx;
  --sw-tab-label-size: ${wechat.tabLabelSize}rpx;
  --sw-tab-label-line-height: ${wechat.tabLabelLineHeight}rpx;

  /* elevation — shadows are only for overlays, the tab bar, the member code
     entry, the digital card and high-level containers */
  --sw-shadow-card: ${shadow(t.elevation.card)};
  --sw-shadow-overlay: ${shadow(t.elevation.overlay)};
  --sw-shadow-membercode: ${shadow(t.elevation.memberCode)};

  /* motion */
  --sw-motion-fast: ${t.motion.fastMs}ms;
  --sw-motion-standard: ${t.motion.standardMs}ms;
}

/* Brand marks, inlined because WXSS cannot reach packages/design-system. */
.sw-brand-mark { background-image: url("${brandUri('brand-mark.svg')}"); background-size: contain; background-repeat: no-repeat; background-position: center; }
.sw-brand-lockup { background-image: url("${brandUri('brand-lockup-horizontal.svg')}"); background-size: contain; background-repeat: no-repeat; background-position: center; }
.sw-brand-pattern { background-image: url("${brandUri('wing-pattern.svg')}"); background-repeat: no-repeat; }
.sw-membercode-mark { background-image: url("${memberCodeUri()}"); background-size: contain; background-repeat: no-repeat; background-position: center; }
`;

// ----------------------------------------------------------------- icons.wxss

const rules = [];
const missing = [];
for (const [name, roles] of Object.entries(ICON_MANIFEST)) {
  for (const role of roles) {
    const colour = ROLES[role];
    if (!colour) {
      missing.push(`${name}: unknown role "${role}"`);
      continue;
    }
    try {
      rules.push(`.i-${name}-${role} { background-image: url("${lucideUri(name, colour)}"); }`);
    } catch {
      missing.push(`${name}: not found in lucide-react`);
    }
  }
}
if (missing.length) {
  console.error('MISSING ASSETS — log them, do not improvise:\n' + missing.join('\n'));
  process.exit(1);
}

const iconsWxss = `/* GENERATED by scripts/build-miniapp-assets.mjs — do not edit by hand. */
/* Geometry: lucide-react ${JSON.parse(readFileSync(join(ROOT, 'node_modules/lucide-react/package.json'), 'utf8')).version} (ISC). */
/* Grid ${t.icon.sizes.standard}, stroke ${t.icon.strokeWidth}, round caps — matches tokens.json icon spec. */
.i {
  display: inline-block;
  width: var(--sw-icon-standard);
  height: var(--sw-icon-standard);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex-shrink: 0;
}
.i-sm { width: var(--sw-icon-small); height: var(--sw-icon-small); }
.i-md { width: var(--sw-icon-medium); height: var(--sw-icon-medium); }
.i-lg { width: var(--sw-icon-large); height: var(--sw-icon-large); }
.i-xl { width: var(--sw-icon-extraLarge); height: var(--sw-icon-extraLarge); }

${rules.join('\n')}
`;

const partnerAssets = Object.fromEntries(Object.entries(PARTNER_LOGOS).map(([key, stem]) => [key, optionalLocalImage(PARTNER_ASSETS, stem, 'assets/partners')]));
const assetsModule = `/* GENERATED by scripts/build-miniapp-assets.mjs — do not edit by hand. */
module.exports = ${JSON.stringify({ partners: partnerAssets }, null, 2)};
`;

mkdirSync(OUT, { recursive: true });
const outputs = {
  'styles/tokens.wxss': tokensWxss,
  'styles/icons.wxss': iconsWxss,
  'data/assets.generated.js': assetsModule,
};

if (process.argv.includes('--check')) {
  const stale = Object.entries(outputs).filter(([file, expected]) => {
    try {
      return normaliseText(readFileSync(join(MP, file), 'utf8')) !== normaliseText(expected);
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`STALE GENERATED ASSETS — run npm run build:miniapp-assets:\n${stale.map(([file]) => `  ${file}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`miniapp generated assets are current — ${Object.keys(outputs).length} files`);
  process.exit(0);
}

for (const [file, content] of Object.entries(outputs)) {
  const destination = join(MP, file);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content, 'utf8');
}

console.log(`tokens.wxss  ${(tokensWxss.length / 1024).toFixed(1)}KB`);
console.log(`icons.wxss   ${(iconsWxss.length / 1024).toFixed(1)}KB  ${rules.length} rules / ${Object.keys(ICON_MANIFEST).length} icons`);
console.log(`member code stroke calibrated: ${CALIBRATE_MEMBER_CODE_STROKE}`);
