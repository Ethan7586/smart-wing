export const PERFORMANCE_TARGET = 95;

const TARGETS = {
  document: { weight: 10, p95Ms: 1_800 },
  catalogMirror: { weight: 25, p95Ms: 1_200 },
  catalogApi: { weight: 25, p95Ms: 1_200, serverP95Ms: 50 },
  liveness: { weight: 10, p95Ms: 700 },
  lcp: { weight: 10, maximum: 2_500 },
  inp: { weight: 10, maximum: 200 },
  cls: { weight: 5, maximum: 0.1 },
  errorRate: { weight: 5, maximum: 0.005 },
};

export function percentile(values, ratio = 0.95) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

export function parseServerTiming(header, name) {
  if (typeof header !== 'string') return null;
  const metric = header
    .split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name};`) || entry === name);
  const duration = metric?.match(/(?:^|;)\s*dur=([0-9.]+)/i)?.[1];
  return duration === undefined ? null : Number(duration);
}

function awarded(condition, target, label, notes) {
  if (condition) return target.weight;
  notes.push(label);
  return 0;
}

/**
 * Scores independently collected evidence. Transport probes contribute 70
 * points; browser measurements carry the final 30, so a missing trace can
 * never be mistaken for a verified 95-point user experience.
 */
export function scoreStorefrontPerformance({ document, catalogMirror, catalogApi, liveness, browser = null }) {
  const notes = [];
  let score = 0;
  score += awarded(document?.allOk && document.p95Ms !== null && document.p95Ms <= TARGETS.document.p95Ms, TARGETS.document, '商城 HTML 首屏响应未达标', notes);
  score += awarded(
    catalogMirror?.allOk && catalogMirror.cacheable && catalogMirror.validJson && catalogMirror.p95Ms !== null && catalogMirror.p95Ms <= TARGETS.catalogMirror.p95Ms,
    TARGETS.catalogMirror,
    '阿里云目录镜像未命中、不可缓存或 P95 超标',
    notes
  );
  score += awarded(
    catalogApi?.allOk && catalogApi.cacheHit && catalogApi.p95Ms !== null && catalogApi.p95Ms <= TARGETS.catalogApi.p95Ms && catalogApi.serverP95Ms !== null && catalogApi.serverP95Ms <= TARGETS.catalogApi.serverP95Ms,
    TARGETS.catalogApi,
    '公开目录 API 未稳定命中缓存或 P95 超标',
    notes
  );
  score += awarded(liveness?.allOk && liveness.probe === 'liveness' && liveness.p95Ms !== null && liveness.p95Ms <= TARGETS.liveness.p95Ms, TARGETS.liveness, '快速存活检查未达标', notes);

  if (!browser) {
    notes.push('缺少真实浏览器 LCP、INP、CLS 与错误率数据，不能宣称已达到 95 分');
  } else {
    score += awarded(browser.lcpMs <= TARGETS.lcp.maximum, TARGETS.lcp, 'LCP 超过 2.5 秒', notes);
    score += awarded(browser.inpMs <= TARGETS.inp.maximum, TARGETS.inp, 'INP 超过 200ms', notes);
    score += awarded(browser.cls <= TARGETS.cls.maximum, TARGETS.cls, 'CLS 超过 0.1', notes);
    score += awarded(browser.errorRate <= TARGETS.errorRate.maximum, TARGETS.errorRate, '前端错误率超过 0.5%', notes);
  }

  return { score, target: PERFORMANCE_TARGET, passed: score >= PERFORMANCE_TARGET && notes.length === 0, notes };
}
