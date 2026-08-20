/**
 * Degradation audit: find files where the current tree LOST content relative to the
 * recovered baseline. Directory-copy merges lose code silently; git cannot warn about
 * it because no merge ever happened. A file that lost exported symbols is the signal.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const BASELINE = process.argv[2] ?? '77b0500';

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function exportsOf(source) {
  const names = new Set();
  const declaration = /export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z0-9_$]+)/g;
  let match;
  while ((match = declaration.exec(source)) !== null) names.add(match[1]);
  const list = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  while ((match = list.exec(source)) !== null) {
    for (const piece of match[1].split(',')) {
      const parts = piece
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0]).trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const changed = run(`git diff --name-only ${BASELINE} -- "*.ts" "*.tsx" "*.sql"`).split('\n').filter(Boolean);
const rows = [];

for (const file of changed) {
  const before = run(`git show ${BASELINE}:${file}`);
  if (!before) continue; // added in current tree, not a regression
  // Always read the working tree: it is the thing that will be built and shipped.
  if (!existsSync(file)) continue;
  const after = readFileSync(file, 'utf8');
  if (!after) continue;

  const beforeLines = before.split('\n').length;
  const afterLines = after.split('\n').length;
  const beforeExports = exportsOf(before);
  const afterExports = exportsOf(after);
  const lost = [...beforeExports].filter((name) => !afterExports.has(name));

  if (lost.length > 0 || afterLines < beforeLines * 0.8) {
    rows.push({ file, beforeLines, afterLines, delta: afterLines - beforeLines, lost });
  }
}

rows.sort((a, b) => a.delta - b.delta);
console.log(`基线 ${BASELINE} 与当前树对比，共 ${changed.length} 个变更文件\n`);
console.log(`疑似降级 ${rows.length} 个：\n`);
for (const row of rows) {
  console.log(`${row.file}`);
  console.log(`   行数 ${row.beforeLines} -> ${row.afterLines}  (${row.delta})`);
  if (row.lost.length > 0) console.log(`   丢失导出 [${row.lost.length}]: ${row.lost.join(', ')}`);
}
const totalLost = rows.reduce((sum, row) => sum + row.lost.length, 0);
const totalLines = rows.reduce((sum, row) => sum + Math.max(0, -row.delta), 0);
console.log(`\n合计丢失导出符号 ${totalLost} 个，丢失代码约 ${totalLines} 行`);
