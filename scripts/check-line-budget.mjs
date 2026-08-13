import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const LIMIT = 299;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.wxml', '.wxss', '.md', '.json', '.toml', '.yml', '.yaml', '.sql']);
const IGNORED_DIRECTORIES = new Set(['.git', '.next', '.open-next', '.wrangler', 'dist', 'node_modules', 'deliverables', 'tools']);
const GENERATED_OR_IMMUTABLE = [
  /(^|\/)package-lock\.json$/,
  /^.*\.tsbuildinfo$/,
  /^database\/supabase\/config\.toml$/,
  /^database\/supabase\/migrations\/.+\.sql$/,
  /^database\/supabase\/\.temp\//,
  /^apps\/wechat-miniapp\/miniprogram\/styles\/(tokens|icons)\.wxss$/,
];
const IMPORTED_ADMIN_LEGACY = new Set([
  'apps/admin-web/src/App.tsx',
  'apps/admin-web/src/components/CaseCenterDrawer.tsx',
  'apps/admin-web/src/components/workstations/CockpitWorkstation.tsx',
  'apps/admin-web/src/components/workstations/EnterpriseWelfareWorkstation.tsx',
  'apps/admin-web/src/components/workstations/OrderFulfillmentWorkstation.tsx',
  'apps/admin-web/src/components/workstations/ProductGovernanceWorkstation.tsx',
  'apps/admin-web/src/data/mockData.ts',
  'apps/admin-web/src/types.ts',
]);
// The imported authentication prototype is intentionally kept intact until its
// mock implementation is replaced by the production commerce API. New auth
// code must meet the normal line limit.
const IMPORTED_AUTH_PROTOTYPE = new Set(['apps/auth-web/src/screens/LoginPage.tsx', 'apps/auth-web/src/services/auth.ts']);

function normalized(path) {
  return relative(ROOT, path).split(sep).join('/');
}

function isException(path) {
  return GENERATED_OR_IMMUTABLE.some((pattern) => pattern.test(path)) || IMPORTED_ADMIN_LEGACY.has(path) || IMPORTED_AUTH_PROTOTYPE.has(path);
}

function collect(directory, output = []) {
  for (const name of readdirSync(directory)) {
    if (IGNORED_DIRECTORIES.has(name)) continue;
    const absolute = join(directory, name);
    const stats = statSync(absolute);
    if (stats.isDirectory()) collect(absolute, output);
    else if (SOURCE_EXTENSIONS.has(extname(name))) output.push(absolute);
  }
  return output;
}

const failures = collect(ROOT)
  .map((absolute) => {
    const path = normalized(absolute);
    const lines = readFileSync(absolute, 'utf8').split(/\r?\n/).length;
    return { path, lines, exception: isException(path) };
  })
  .filter((file) => !file.exception && file.lines > LIMIT)
  .sort((left, right) => right.lines - left.lines);

if (failures.length) {
  console.error(`发现 ${failures.length} 个可维护文件超过 ${LIMIT} 行：`);
  failures.forEach(({ path, lines }) => console.error(`${lines}\t${path}`));
  process.exit(1);
}

console.log(`行数门禁通过：所有新增与已整理源码不超过 ${LIMIT} 行；` + '锁文件、生成配置、已应用数据库迁移及导入后台/认证原型按例外清单管理。');
