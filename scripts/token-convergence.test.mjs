import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_PATH = join(ROOT, 'packages/design-system/src/tokens.json');
const PLATFORMS_PATH = join(ROOT, 'packages/design-system/src/mobile-platforms.json');
const WEB_PATH = join(ROOT, 'packages/design-system/src/tokens.css');
const MINI_PATH = join(ROOT, 'apps/wechat-miniapp/miniprogram/styles/tokens.wxss');
const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
const platforms = JSON.parse(readFileSync(PLATFORMS_PATH, 'utf8'));

const rem = (value) => (value === 0 ? '0' : `${value / 16}rem`);
const rpx = (value) => `${value * 2}rpx`;
const shadow = (entry, unit) => {
  const value = unit === 'rem' ? (number) => `${number}px` : rpx;
  return `${value(entry.x)} ${value(entry.y)} ${value(entry.blur)} rgba(${entry.color.join(', ')}, ${entry.alpha})`;
};
const quoteFamilies = (stack) =>
  stack
    .split(',')
    .map((name) => name.trim())
    .map((name) => (name.includes(' ') && !name.startsWith("'") ? `'${name}'` : name))
    .join(', ');

function variablesBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return new Map([...source.slice(start, end).matchAll(/^\s*(--sw-[\w-]+):\s*(.+);$/gm)].map((match) => [match[1], match[2]]));
}

function assertVariables(label, actual, expected) {
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), `${label} variable surface drifted`);
  for (const [name, value] of expected) assert.equal(actual.get(name), value, `${label} ${name}`);
}

function webExpectations() {
  const c = tokens.color;
  const type = tokens.typography;
  const expected = new Map([
    ['--sw-brand', c.brand.primary],
    ['--sw-brand-hover', c.brand.primaryHover],
    ['--sw-brand-dark', c.brand.dark],
    ['--sw-brand-light', c.brand.light],
    ['--sw-brand-ink', c.brand.ink],
    ['--sw-sidebar-top', c.dark.surface],
    ['--sw-brand-gradient', `linear-gradient(135deg, ${c.brand.primary} 0%, ${c.brand.dark} 100%)`],
    ['--sw-sidebar-gradient', `linear-gradient(180deg, ${c.dark.surface} 0%, ${c.dark.background} 100%)`],
    ['--sw-background', c.surface.background],
    ['--sw-surface', c.surface.base],
    ['--sw-surface-subtle', c.surface.subtle],
    ['--sw-text', c.text.primary],
    ['--sw-text-secondary', c.text.secondary],
    ['--sw-muted', c.text.muted],
    ['--sw-disabled', c.text.disabled],
    ['--sw-border', c.surface.border],
    ['--sw-border-strong', c.surface.borderStrong],
    ['--sw-font-sans', quoteFamilies(`${type.families.latin.split(',')[0]}, ${type.families.chinese.replace(/,\s*sans-serif$/, '')}, Arial, sans-serif`)],
    ['--sw-font-mono', quoteFamilies(type.families.mono)],
    ['--sw-radius-full', `${tokens.radius.full}px`],
    ['--sw-radius', 'var(--sw-radius-sm)'],
    ['--sw-shadow-card', shadow(tokens.elevation.card, 'rem')],
    ['--sw-shadow-overlay', shadow(tokens.elevation.overlay, 'rem')],
    ['--sw-duration-fast', `${tokens.motion.fastMs}ms`],
    ['--sw-duration-standard', `${tokens.motion.standardMs}ms`],
    ['--sw-duration-slow', `${tokens.motion.slowMs}ms`],
    ['--sw-ease-standard', `cubic-bezier(${tokens.motion.standardEasing.join(', ')})`],
    ['--sw-ease-emphasized', `cubic-bezier(${tokens.motion.emphasizedEasing.join(', ')})`],
    ['--sw-wing-code-size', rem(platforms.ios.wingCodeButtonSize)],
    ['--sw-wing-code-shadow', shadow(tokens.elevation.memberCode, 'rem')],
    ['--sw-wing-code-valid-seconds', String(tokens.wingCode.validSeconds)],
    ['--sw-min-touch-target', rem(platforms.ios.minimumTouchTarget)],
  ]);
  for (const [name, value] of Object.entries(c.semantic)) expected.set(`--sw-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  for (const [name, style] of Object.entries(type.styles)) {
    if (name === 'amount') continue;
    const key = name === 'bodySmall' ? 'body-sm' : name;
    expected.set(`--sw-font-size-${key}`, rem(style.size));
    expected.set(`--sw-line-height-${key}`, rem(style.lineHeight));
  }
  const spacingNames = { half: '0-5', '1_5': '1-5' };
  for (const [name, value] of Object.entries(tokens.spacing)) expected.set(`--sw-space-${spacingNames[name] || name}`, rem(value));
  const radiusNames = { small: 'sm', medium: 'md', large: 'lg', extraLarge: 'xl' };
  for (const [name, value] of Object.entries(tokens.radius)) if (name !== 'full') expected.set(`--sw-radius-${radiusNames[name]}`, rem(value));
  return expected;
}

function miniExpectations() {
  const c = tokens.color;
  const wechat = platforms.wechatMiniProgram;
  const standard = platforms.sizeClasses.find(({ key }) => key === 'standard');
  const expected = new Map([
    ['--sw-brand', c.brand.primary],
    ['--sw-brand-hover', c.brand.primaryHover],
    ['--sw-brand-dark', c.brand.dark],
    ['--sw-brand-ink', c.brand.ink],
    ['--sw-brand-light', c.brand.light],
    ['--sw-brand-gradient', `linear-gradient(135deg, ${c.brand.primary} 0%, ${c.brand.dark} 100%)`],
    ['--sw-background', c.surface.background],
    ['--sw-surface', c.surface.base],
    ['--sw-surface-subtle', c.surface.subtle],
    ['--sw-border', c.surface.border],
    ['--sw-border-strong', c.surface.borderStrong],
    ['--sw-text', c.text.primary],
    ['--sw-text-secondary', c.text.secondary],
    ['--sw-text-muted', c.text.muted],
    ['--sw-text-disabled', c.text.disabled],
    ['--sw-text-inverse', c.text.inverse],
    ['--sw-font-cn', tokens.typography.families.chinese],
    ['--sw-font-num', tokens.typography.families.financial],
    ['--sw-text-scale', '1'],
    ['--sw-space-scale', '1'],
    ['--sw-page-inset', `calc(${wechat.pageHorizontalInset}rpx * var(--sw-space-scale))`],
    ['--sw-radius-full', '9999rpx'],
    ['--sw-membercode-size', `calc(${wechat.wingCodeButtonSize}rpx * var(--sw-space-scale))`],
    ['--sw-membercode-protrusion', `calc(${wechat.wingCodeProtrusion}rpx * var(--sw-space-scale))`],
    ['--sw-touch-min', `calc(${wechat.minimumTouchTarget}rpx * var(--sw-space-scale))`],
    ['--sw-tabbar-height', `calc(${wechat.tabBarHeight}rpx * var(--sw-space-scale))`],
    ['--sw-tab-icon-top', `calc(${wechat.tabIconTop}rpx * var(--sw-space-scale))`],
    ['--sw-tab-label-clearance', `calc(${wechat.tabLabelClearance}rpx * var(--sw-space-scale))`],
    ['--sw-tab-label-top', `calc(${wechat.tabLabelTop}rpx * var(--sw-space-scale))`],
    ['--sw-tab-center-label-top', `calc(${wechat.tabCenterLabelTop}rpx * var(--sw-space-scale))`],
    ['--sw-tab-label-size', `calc(${wechat.tabLabelSize}rpx * var(--sw-text-scale))`],
    ['--sw-tab-label-line-height', `calc(${wechat.tabLabelLineHeight}rpx * var(--sw-text-scale))`],
    ['--sw-product-columns', String(standard.productColumns)],
    ['--sw-product-width', `calc(100% / ${standard.productColumns} - 16rpx)`],
    ['--sw-partner-visible', String(standard.partnerVisible)],
    ['--sw-partner-width', `calc(100% / ${standard.partnerVisible} - 16rpx)`],
    ['--sw-shadow-card', shadow(tokens.elevation.card, 'rpx')],
    ['--sw-shadow-overlay', shadow(tokens.elevation.overlay, 'rpx')],
    ['--sw-shadow-membercode', shadow(tokens.elevation.memberCode, 'rpx')],
    ['--sw-motion-fast', `${tokens.motion.fastMs}ms`],
    ['--sw-motion-standard', `${tokens.motion.standardMs}ms`],
  ]);
  for (const [name, value] of Object.entries(tokens.opacity)) expected.set(`--sw-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, `rgba(255, 255, 255, ${value})`);
  for (const [name, value] of Object.entries(c.semantic)) expected.set(`--sw-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  for (const [name, style] of Object.entries(tokens.typography.styles)) {
    expected.set(`--sw-fs-${name}`, `calc(${rpx(style.size)} * var(--sw-text-scale))`);
    expected.set(`--sw-lh-${name}`, `calc(${rpx(style.lineHeight)} * var(--sw-text-scale))`);
    expected.set(`--sw-fw-${name}`, String(style.weight));
  }
  for (const [name, value] of Object.entries(tokens.spacing)) expected.set(`--sw-space-${name}`, rpx(value));
  for (const [name, value] of Object.entries(tokens.radius)) if (name !== 'full') expected.set(`--sw-radius-${name}`, rpx(value));
  for (const [name, value] of Object.entries(tokens.icon.sizes)) expected.set(`--sw-icon-${name}`, `calc(${rpx(value)} * var(--sw-space-scale))`);
  return expected;
}

test('both generated token surfaces are byte-current and checks stay read-only', () => {
  execFileSync(process.execPath, [join(ROOT, 'scripts/build-web-tokens.mjs'), '--check'], { cwd: ROOT, stdio: 'pipe' });
  execFileSync(process.execPath, [join(ROOT, 'scripts/build-miniapp-assets.mjs'), '--check'], { cwd: ROOT, stdio: 'pipe' });
});

test('Web and mini-program variables are independently re-derived from their sources', () => {
  const web = variablesBetween(readFileSync(WEB_PATH, 'utf8'), ':root {', '\n}\n\n@media');
  const mini = variablesBetween(readFileSync(MINI_PATH, 'utf8'), 'page,\n.sw-tokens {', '\n}\n\n/* Size classes');
  assertVariables('tokens.css', web, webExpectations());
  assertVariables('tokens.wxss', mini, miniExpectations());
});

test('mobile platform shared values remain locked to the master tokens', () => {
  const shared = platforms.shared;
  assert.deepEqual(shared.navigation, tokens.wingCode.navigation);
  assert.equal(tokens.brand.signatureFeature, tokens.wingCode.label);
  assert.equal(shared.navigation[2], tokens.wingCode.label);
  assert.equal(shared.wingCodeValidSeconds, tokens.wingCode.validSeconds);
  assert.equal(shared.cardRadius, tokens.radius.large);
  assert.equal(shared.pageHorizontalInset, tokens.spacing['2']);
  assert.equal(platforms.ios.pageHorizontalInset, shared.pageHorizontalInset);
  assert.equal(platforms.android.pageHorizontalInset, shared.pageHorizontalInset);
  assert.equal(platforms.wechatMiniProgram.pageHorizontalInset, shared.pageHorizontalInset * 2);
});

test('an in-memory generated-token mutation is rejected by the independent assertion', () => {
  const actual = variablesBetween(readFileSync(WEB_PATH, 'utf8'), ':root {', '\n}\n\n@media');
  actual.set('--sw-brand', '#000000');
  assert.throws(() => assertVariables('mutated tokens.css', actual, webExpectations()), /--sw-brand/);
});
