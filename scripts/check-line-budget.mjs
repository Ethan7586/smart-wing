import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const LIMIT = 299;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.md', '.json', '.toml', '.yml', '.yaml', '.sql']);
const IGNORED_DIRECTORIES = new Set(['.git', '.next', '.open-next', '.wrangler', 'dist', 'node_modules', 'deliverables', 'tools']);
const GENERATED_OR_IMMUTABLE = [/(^|\/)package-lock\.json$/, /^.*\.tsbuildinfo$/, /^supabase\/config\.toml$/, /^supabase\/migrations\/.+\.sql$/, /^supabase\/\.temp\//, /^drizzle\/.+\.sql$/];

function normalized(path) {
  return relative(ROOT, path).split(sep).join('/');
}

function isException(path) {
  return GENERATED_OR_IMMUTABLE.some((pattern) => pattern.test(path));
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

console.log(`行数门禁通过：所有可维护源码不超过 ${LIMIT} 行；` + '锁文件、生成配置和已应用数据库迁移按不可变制品管理。');
