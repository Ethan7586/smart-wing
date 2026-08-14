import ts from 'typescript';

const WHOLE_COLOR = /^\s*(?:#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})|(?:rgb|hsl)a?\s*\([^)]*\))\s*$/i;
function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function scriptKind(extension) {
  return {
    '.ts': ts.ScriptKind.TS,
    '.tsx': ts.ScriptKind.TSX,
    '.js': ts.ScriptKind.JS,
    '.jsx': ts.ScriptKind.JSX,
  }[extension];
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return '';
}

function staticValue(node, sourceFile, source) {
  if (ts.isStringLiteralLike(node)) {
    return { text: node.text, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1, kind: 'string' };
  }
  if (ts.isNumericLiteral(node)) {
    return { text: node.text, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1, kind: 'number' };
  }
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    return { text: node.getText(sourceFile), line: lineAt(source, node.getStart(sourceFile)), kind: 'number' };
  }
  return null;
}

function analyseScript(source, extension) {
  const sourceFile = ts.createSourceFile(`source${extension}`, source, ts.ScriptTarget.Latest, true, scriptKind(extension));
  const contexts = { strings: [], styles: [], colors: [], rawLines: source.split(/\r?\n/) };

  const addString = (text, position) => {
    const line = sourceFile.getLineAndCharacterOfPosition(position).line + 1;
    contexts.strings.push({ text, line });
    if (WHOLE_COLOR.test(text)) contexts.colors.push({ text, line });
  };

  const addStyle = (name, initializer) => {
    const value = staticValue(initializer, sourceFile, source);
    if (!value) return;
    contexts.styles.push({ property: name, ...value, origin: 'script' });
  };

  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) addString(node.text, node.getStart(sourceFile));
    if (ts.isTemplateExpression(node)) {
      addString(node.head.text, node.head.getStart(sourceFile));
      for (const span of node.templateSpans) addString(span.literal.text, span.literal.getStart(sourceFile));
    }
    if (ts.isPropertyAssignment(node)) addStyle(propertyName(node.name), node.initializer);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left)) {
      addStyle(node.left.name.text, node.right);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return contexts;
}

function blankComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

function analyseStylesheet(source) {
  const code = blankComments(source);
  const contexts = { strings: [], styles: [], colors: [], rawLines: source.split(/\r?\n/) };
  const declaration = /(?:^|[;{\n])\s*([-$\w]+)\s*:\s*([^;{}]+)(?=[;}])/gm;

  for (const match of code.matchAll(declaration)) {
    const property = match[1];
    const value = match[2].trim();
    const valueOffset = (match.index || 0) + match[0].indexOf(match[2]);
    const line = lineAt(code, valueOffset);
    contexts.styles.push({ property, text: value, line, kind: 'string', origin: 'css' });
    if (property.toLowerCase() !== 'content') {
      const withoutUrls = value.replace(/url\([^)]*\)/gi, '');
      contexts.colors.push({ text: withoutUrls, line });
    }
  }

  for (const match of code.matchAll(/@apply\s+([^;]+);/g)) {
    contexts.strings.push({ text: match[1], line: lineAt(code, match.index || 0) });
  }
  return contexts;
}

export function analyseSource(source, extension) {
  return extension === '.css' || extension === '.scss' ? analyseStylesheet(source) : analyseScript(source, extension);
}
