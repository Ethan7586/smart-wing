import { execFileSync } from 'node:child_process';
import process from 'node:process';

// 主站与真实 API 同源在 hbbtzn.com；管理后台 smart.hbbtzn.com 是独立 SPA，不承载业务 API。
const BASE_URL = process.env.MVP_SITE_URL ?? 'https://hbbtzn.com';
const STATUS_MARKER = '\n__HTTP_STATUS__';

/**
 * Cloudflare Bot Management 会按 TLS 指纹拦截 Node(undici) 的请求，换 User-Agent 无效。
 * 系统自带的 curl 使用平台原生 TLS 栈，指纹可通过，因此优先走 curl；
 * 没有 curl 时退回 fetch，并在被挑战时如实报告"未验证"，绝不当作通过。
 */
function curlAvailable() {
  try {
    execFileSync('curl', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const USE_CURL = curlAvailable();

function isCloudflareChallenge(status, body) {
  return status === 403 && (body.includes('Attention Required') || body.includes('cf-error-details') || body.includes('Cloudflare'));
}

function requestViaCurl(path, init) {
  const args = ['-sS', '--max-time', '20', '-o', '-', '-w', STATUS_MARKER + '%{http_code}', '-X', init.method ?? 'GET'];
  for (const [key, value] of Object.entries({ accept: 'application/json', ...(init.headers ?? {}) })) args.push('-H', `${key}: ${value}`);
  if (init.body) args.push('--data-binary', init.body);
  args.push(`${BASE_URL}${path}`);
  const output = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const cut = output.lastIndexOf(STATUS_MARKER);
  const status = cut === -1 ? 0 : Number.parseInt(output.slice(cut + STATUS_MARKER.length), 10);
  return { status, body: cut === -1 ? output : output.slice(0, cut) };
}

async function requestViaFetch(path, init) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: { accept: 'application/json', ...(init.headers ?? {}) },
    body: init.body,
  });
  return { status: response.status, body: await response.text() };
}

async function request(path, init = {}) {
  try {
    return USE_CURL ? requestViaCurl(path, init) : await requestViaFetch(path, init);
  } catch (error) {
    return { status: 0, body: `TRANSPORT_ERROR: ${error instanceof Error ? error.message : 'unknown'}` };
  }
}

const results = [];

function record(name, outcome, detail) {
  results.push({ name, outcome, detail });
  const icon = outcome === 'pass' ? '✅' : outcome === 'blocked' ? '🚫' : '❌';
  console.log(`${icon} ${name}：${detail}`);
}

/** 被 Cloudflare 挑战 = 本次没验到，记为 blocked（不是通过，也不是应用故障）。 */
async function check(name, path, init, assert) {
  const response = await request(path, init);
  if (isCloudflareChallenge(response.status, response.body)) {
    record(name, 'blocked', `被 Cloudflare 挑战拦截，本次未验证（当前传输层：${USE_CURL ? 'curl' : 'fetch'}）`);
    return;
  }
  if (response.status === 0) {
    record(name, 'fail', response.body);
    return;
  }
  const verdict = assert(response);
  record(name, verdict.ok ? 'pass' : 'fail', verdict.detail);
}

async function main() {
  console.log(`P0 验收冒烟：${BASE_URL}（传输层 ${USE_CURL ? 'curl / 原生 TLS' : 'node fetch'}）\n`);

  await check('健康检查', '/api/health', {}, (r) => ({
    ok: r.status === 200 && /"status"\s*:\s*"ok"/.test(r.body),
    detail: r.status === 200 ? `HTTP 200，status=${/"status"\s*:\s*"(\w+)"/.exec(r.body)?.[1] ?? '未知'}` : `HTTP ${r.status}`,
  }));

  await check('未登录会话拒绝', '/api/v1/auth/session', { headers: { 'x-requested-with': 'ci-smoke' } }, (r) => ({
    ok: r.status === 401,
    detail: r.status === 401 ? 'HTTP 401 AUTHENTICATION_REQUIRED，符合安全策略' : `期望 401，实际 ${r.status}`,
  }));

  await check('商品目录可访问', '/api/v1/products?mall=smart-wing-demo&limit=1', {}, (r) => ({
    ok: r.status === 200 && r.body.includes('"items"'),
    detail: r.status === 200 ? 'HTTP 200，返回 items 列表' : `期望 200，实际 ${r.status}`,
  }));

  // 注意：这一项会写入登录失败计数；同一来源 15 分钟内累计 5 次会被封禁 15 分钟。
  await check('错误访问码被拒绝', '/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accessCode: 'smoke-check-code-invalid' }) }, (r) => ({
    ok: r.status === 401,
    detail: r.status === 401 ? 'HTTP 401 INVALID_ACCESS_CODE，登录保护生效' : `期望 401，实际 ${r.status}`,
  }));

  const failed = results.filter((item) => item.outcome === 'fail');
  const blocked = results.filter((item) => item.outcome === 'blocked');
  const passed = results.filter((item) => item.outcome === 'pass');
  console.log(`\n通过 ${passed.length} / 失败 ${failed.length} / 未验证 ${blocked.length}（共 ${results.length} 项）`);

  if (failed.length) {
    console.error('\nP0 验收冒烟：未通过');
    process.exitCode = 1;
    return;
  }
  if (blocked.length) {
    console.error(`\nP0 验收冒烟：结论不成立 —— 有 ${blocked.length} 项未验证。请改用白名单网络或已放通的来源复测，不得据此签署验收。`);
    process.exitCode = 2;
    return;
  }
  console.log('\nP0 验收冒烟：通过');
}

void main();
