export const RULES = [
  'hardcoded-color',
  'font-size-floor',
  'font-weight-ceiling',
  'radius-off-scale',
  'palette-drift',
  'semantic-duplicate',
];

const COLOR = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\da-f])|\b(?:rgb|hsl)a?\s*\([^)]*\)/gi;
const DRIFT = new Set(['purple', 'indigo', 'cyan', 'rose', 'teal', 'pink']);
const DUPLICATE = new Set(['yellow', 'orange', 'green']);
const COLOR_UTILITIES = new Set([
  'bg',
  'text',
  'border',
  'ring',
  'outline',
  'decoration',
  'divide',
  'shadow',
  'accent',
  'caret',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
]);
const DIRECTIONS = new Set(['t', 'r', 'b', 'l', 'x', 'y', 's', 'e', 'ss', 'se', 'es', 'ee', 'tl', 'tr', 'bl', 'br']);
const ROUNDED_SCALE = new Map([
  ['none', 0],
  ['sm', 4],
  ['DEFAULT', 4],
  ['md', 6],
  ['lg', 8],
  ['xl', 12],
  ['2xl', 16],
  ['3xl', 24],
  ['full', Infinity],
]);

function add(findings, rule, line, detail) {
  findings.push({ rule, line, detail });
}

function lineOf(context, index) {
  return context.line + context.text.slice(0, index).split('\n').length - 1;
}

function unvariant(token) {
  let depth = 0;
  let split = -1;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === '[') depth += 1;
    else if (token[index] === ']') depth -= 1;
    else if (token[index] === ':' && depth === 0) split = index;
  }
  return token.slice(split + 1).replace(/^!/, '');
}

function tokens(context) {
  return [...context.text.matchAll(/\S+/g)].map((match) => ({ value: unvariant(match[0]), index: match.index || 0 }));
}

function numericPixels(value, origin, property) {
  const match = String(value).trim().match(/^(-?\d*\.?\d+)\s*(px|rem|pt)?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  const unit = (match[2] || '').toLowerCase();
  if (!unit && origin === 'css' && number !== 0) return null;
  if (!unit && origin === 'script' && ['fontsize', 'borderradius'].includes(property)) return number;
  if (unit === 'rem') return number * 16;
  if (unit === 'pt') return number * (4 / 3);
  return number;
}

function radiusAllowed(value, allowed, origin) {
  const clean = String(value).trim();
  if (/^var\(--sw-radius-[^)]+\)$/.test(clean) || clean === '50%' || clean === '9999px') return true;
  const pieces = clean.replaceAll('_', ' ').split(/[\s/]+/).filter(Boolean);
  if (!pieces.length) return true;
  return pieces.every((piece) => {
    const px = numericPixels(piece, origin, 'borderradius');
    return px !== null && (px === 0 || allowed.has(px));
  });
}

function roundedValue(utility) {
  if (utility === 'rounded') return 'DEFAULT';
  if (!utility.startsWith('rounded-')) return null;
  const parts = utility.slice(8).split('-');
  if (DIRECTIONS.has(parts[0])) parts.shift();
  return parts.join('-') || 'DEFAULT';
}

function scanUtility(context, findings, allowedRadii) {
  for (const token of tokens(context)) {
    const utility = token.value;
    const at = lineOf(context, token.index);
    const colour = utility.match(/^(?:bg|text|border|ring|outline|decoration|divide|shadow|accent|caret|fill|stroke|from|via|to)-([a-z]+)-(?:\d{2,3})(?:\/\d{1,3})?$/);
    if (colour && DRIFT.has(colour[1])) add(findings, 'palette-drift', at, utility);
    if (colour && DUPLICATE.has(colour[1])) add(findings, 'semantic-duplicate', at, utility);

    const arbitrary = utility.match(/^([a-z]+)-\[([\s\S]+)\](?:\/.+)?$/);
    if (arbitrary && COLOR_UTILITIES.has(arbitrary[1])) {
      for (const match of arbitrary[2].matchAll(COLOR)) add(findings, 'hardcoded-color', at, match[0]);
    }
    if (arbitrary?.[1] === 'text') {
      const px = numericPixels(arbitrary[2], 'css', 'fontsize');
      if (px !== null && px > 0 && px < 12) add(findings, 'font-size-floor', at, utility);
    }
    if (/^font-(?:black|extrabold)$/.test(utility)) add(findings, 'font-weight-ceiling', at, utility);
    const arbitraryWeight = utility.match(/^font-\[(\d+)\]$/);
    if (arbitraryWeight && Number(arbitraryWeight[1]) >= 800) add(findings, 'font-weight-ceiling', at, utility);

    const radius = roundedValue(utility);
    if (radius === null) continue;
    if (radius.startsWith('[') && radius.endsWith(']')) {
      if (!radiusAllowed(radius.slice(1, -1), allowedRadii, 'css')) add(findings, 'radius-off-scale', at, utility);
    } else if (!ROUNDED_SCALE.has(radius) || ![0, 8, 12, 16, 24, Infinity].includes(ROUNDED_SCALE.get(radius))) {
      add(findings, 'radius-off-scale', at, utility);
    }
  }
}

export function scanViRules(contexts, radiusValues) {
  const findings = [];
  const allowedRadii = new Set(radiusValues);
  for (const context of contexts.strings) scanUtility(context, findings, allowedRadii);
  for (const context of contexts.colors) {
    for (const match of context.text.matchAll(COLOR)) add(findings, 'hardcoded-color', lineOf(context, match.index || 0), match[0]);
  }
  for (const context of contexts.styles) {
    const property = context.property.replaceAll('-', '').toLowerCase();
    if (property === 'fontsize') {
      const px = numericPixels(context.text, context.origin, property);
      if (px !== null && px > 0 && px < 12) add(findings, 'font-size-floor', context.line, `${context.property}: ${context.text}`);
    }
    if (property === 'fontweight' && /^\d+$/.test(context.text.trim()) && Number(context.text) >= 800) {
      add(findings, 'font-weight-ceiling', context.line, `${context.property}: ${context.text}`);
    }
    if (property.startsWith('border') && property.endsWith('radius') && !radiusAllowed(context.text, allowedRadii, context.origin)) {
      add(findings, 'radius-off-scale', context.line, `${context.property}: ${context.text}`);
    }
  }
  return findings;
}
