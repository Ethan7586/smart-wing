/**
 * Single entry point for every architecture audit.
 *
 *   node scripts/audit/index.mjs            run all audits, exit non-zero on any finding
 *   node scripts/audit/index.mjs callgraph  run one audit
 *   node scripts/audit/index.mjs --summary  counts only
 */
import { auditCallGraph } from './callgraph.mjs';
import { auditDuplicates } from './duplicate.mjs';
import { auditNaming } from './naming.mjs';
import { auditBoundaries } from './boundary.mjs';

const AUDITS = {
  callgraph: { label: '调用点断裂', run: auditCallGraph },
  duplicate: { label: '重复逻辑与配置', run: auditDuplicates },
  naming: { label: '命名规范', run: auditNaming },
  boundary: { label: '模块边界与依赖方向', run: auditBoundaries },
};

const args = process.argv.slice(2);
const summaryOnly = args.includes('--summary');
const selected = args.filter((argument) => !argument.startsWith('--'));
const names = selected.length > 0 ? selected : Object.keys(AUDITS);

let total = 0;
const report = [];

for (const name of names) {
  const audit = AUDITS[name];
  if (!audit) {
    console.error(`unknown audit: ${name}`);
    process.exit(2);
  }
  const findings = audit.run();
  total += findings.length;
  report.push({ name, label: audit.label, findings });
}

for (const { name, label, findings } of report) {
  console.log(`\n=== ${name} (${label}) : ${findings.length} ===`);
  if (summaryOnly) continue;
  const byKind = new Map();
  for (const finding of findings) {
    if (!byKind.has(finding.kind)) byKind.set(finding.kind, []);
    byKind.get(finding.kind).push(finding);
  }
  for (const [kind, group] of [...byKind].sort()) {
    console.log(`  [${kind}] ${group.length}`);
    for (const finding of group.slice(0, 15)) console.log(`    ${finding.file}  ${finding.detail}`);
    if (group.length > 15) console.log(`    ... ${group.length - 15} more`);
  }
}

console.log(`\ntotal findings: ${total}`);
process.exit(total > 0 ? 1 : 0);
