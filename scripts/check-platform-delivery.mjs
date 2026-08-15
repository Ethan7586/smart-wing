import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const MATRIX_PATH = resolve(ROOT, 'packages/api-contract/src/delivery-matrix.json');
const PLATFORM_CONTRACT_PATH = resolve(ROOT, 'packages/api-contract/src/platform.ts');
const REQUIRED = ['web', 'wechat-miniapp'];
const RESERVED = ['harmonyos', 'ios', 'android'];
const CONSISTENCY = new Set(['authoritative-command', 'strong-read', 'eventual-read', 'tracked-async']);
const STATUS = new Set(['implemented', 'partial', 'planned', 'reserved', 'not-applicable']);

function fail(message) {
  console.error(`[platform-delivery] ${message}`);
  process.exitCode = 1;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function verifyEvidence(capabilityId, platform, evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    fail(`${capabilityId}/${platform} 标记 implemented，但没有代码证据`);
    return;
  }
  for (const entry of evidence) {
    const separator = typeof entry === 'string' ? entry.indexOf('::') : -1;
    if (separator <= 0) {
      fail(`${capabilityId}/${platform} 的 evidence 格式必须是 path::marker`);
      continue;
    }
    const path = entry.slice(0, separator);
    const marker = entry.slice(separator + 2);
    let source = '';
    try {
      source = readFileSync(resolve(ROOT, path), 'utf8');
    } catch {
      fail(`${capabilityId}/${platform} 的证据文件不存在：${path}`);
      continue;
    }
    if (!source.includes(marker)) fail(`${capabilityId}/${platform} 的证据已漂移：${entry}`);
  }
}

const matrix = JSON.parse(readFileSync(MATRIX_PATH, 'utf8'));
if (matrix.version !== 1) fail('交付矩阵 version 必须为 1');
if (!same(matrix.requiredDeliveryPlatforms, REQUIRED)) fail(`当前强制交付端必须为 ${REQUIRED.join(' + ')}`);
if (!same(matrix.reservedPlatforms, RESERVED)) fail(`未来保留端必须为 ${RESERVED.join(' + ')}`);
if (!Array.isArray(matrix.capabilities) || matrix.capabilities.length === 0) fail('交付矩阵必须至少包含一个业务能力');

const ids = new Set();
for (const capability of matrix.capabilities ?? []) {
  if (!capability.id || ids.has(capability.id)) fail(`业务能力 id 缺失或重复：${capability.id ?? '(empty)'}`);
  ids.add(capability.id);
  if (!CONSISTENCY.has(capability.consistency)) fail(`${capability.id} 的一致性模式无效：${capability.consistency}`);
  const expectedPlatforms = [...REQUIRED, ...RESERVED];
  for (const platform of expectedPlatforms) {
    const delivery = capability.platforms?.[platform];
    if (!delivery || !STATUS.has(delivery.status)) {
      fail(`${capability.id} 缺少 ${platform} 的有效状态`);
      continue;
    }
    if (delivery.status === 'implemented') verifyEvidence(capability.id, platform, delivery.evidence);
    if (RESERVED.includes(platform) && delivery.status !== 'reserved' && delivery.status !== 'not-applicable') {
      fail(`${capability.id}/${platform} 尚未实施，只能登记 reserved 或 not-applicable`);
    }
  }
  const pairComplete = REQUIRED.every((platform) => capability.platforms?.[platform]?.status === 'implemented');
  if (capability.releaseReady !== pairComplete) {
    fail(`${capability.id} 的 releaseReady=${capability.releaseReady} 与 Web+小程序实际完成度不一致`);
  }
}

const platformContract = readFileSync(PLATFORM_CONTRACT_PATH, 'utf8');
for (const platform of [...REQUIRED, ...RESERVED]) {
  if (!platformContract.includes(`'${platform}'`)) fail(`平台接口未保留 ${platform}`);
}
for (const adapter of ['PlatformIdentityAdapter', 'PlatformPaymentAdapter', 'PlatformStorageAdapter', 'PlatformShareAdapter', 'PlatformNavigationAdapter', 'PlatformLifecycleAdapter', 'PlatformTelemetryAdapter']) {
  if (!platformContract.includes(`interface ${adapter}`)) fail(`缺少平台端口 ${adapter}`);
}

if (!process.exitCode) {
  const pending = (matrix.capabilities ?? []).filter((capability) => capability.releaseReady !== true).map((capability) => capability.id);
  console.log(`多端交付门禁通过：${matrix.capabilities.length} 项能力已登记；Web + 小程序是当前强制交付对；鸿蒙/iOS/Android 接口已保留。`);
  if (pending.length) console.log(`未达到多端完成（不得宣称整体完成）：${pending.join('、')}`);
}
