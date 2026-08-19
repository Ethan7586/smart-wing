#!/usr/bin/env node
/**
 * Drains the client crash outbox and mails one alert per new fault.
 *
 * Runs on the Node host, not on Cloudflare Workers: Workers cannot open the
 * raw TCP connection SMTP needs. The API only writes outbox rows; delivery
 * happens here so a mail outage never blocks a crash from being recorded.
 *
 * The mail body carries the fault code, the route and the counts. It never
 * carries the stack, the member identity or any order data — that detail stays
 * in the database behind the admin permission check.
 */
import { createTransport } from 'nodemailer';

const WORKER_NAME = `client-error-alerts@${process.env.HOSTNAME ?? 'node'}`;
const BATCH_SIZE = Number(process.env.CLIENT_ERROR_ALERT_BATCH ?? 10);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`);
  return value;
}

async function callRpc(functionName, parameters) {
  const baseUrl = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(parameters),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`RPC_FAILED:${functionName}:${response.status}:${(await response.text()).slice(0, 500)}`);
  return response.status === 204 ? null : response.json();
}

function buildTransport() {
  return createTransport({
    host: requiredEnv('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: requiredEnv('SMTP_USER'), pass: requiredEnv('SMTP_PASSWORD') },
  });
}

function renderMail({ faultCode, surface, route, message, occurrenceCount, affectedMemberCount, firstSeenAt }, reason) {
  const headline = reason === 'first_seen' ? '新故障' : '故障升级';
  const app = surface === 'admin' ? '运营后台' : '员工商城';
  return {
    subject: `[智慧翼] ${headline} ${faultCode} · ${app}`,
    text: [
      `故障编号：${faultCode}`,
      `应用：${app}`,
      `页面：${route}`,
      `错误：${message}`,
      `累计次数：${occurrenceCount}`,
      `影响账号数：${affectedMemberCount}`,
      `首次出现：${firstSeenAt}`,
      '',
      '完整堆栈与受影响账号请在运营后台「系统治理台」按故障编号查看。',
      '本邮件不含堆栈与业务数据。',
    ].join('\n'),
  };
}

async function main() {
  const items = await callRpc('api_claim_client_error_outbox', { p_worker: WORKER_NAME, p_limit: BATCH_SIZE });
  if (!Array.isArray(items) || items.length === 0) {
    console.log('client-error-alerts: 无待发送故障通知');
    return;
  }

  const transport = buildTransport();
  const from = requiredEnv('SMTP_FROM');
  const to = requiredEnv('CLIENT_ERROR_ALERT_TO');
  let delivered = 0;

  for (const item of items) {
    const mail = renderMail(item.payload, item.reason);
    try {
      await transport.sendMail({ from, to, subject: mail.subject, text: mail.text });
      await callRpc('api_complete_client_error_outbox', { p_id: item.id, p_delivered: true });
      delivered += 1;
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      await callRpc('api_complete_client_error_outbox', { p_id: item.id, p_delivered: false, p_error: detail });
      console.error(`client-error-alerts: ${item.payload.faultCode} 发送失败（第 ${item.attempts} 次）：${detail}`);
    }
  }

  console.log(`client-error-alerts: 已发送 ${delivered}/${items.length} 条`);
}

main().catch((cause) => {
  console.error('client-error-alerts: 运行失败', cause);
  process.exitCode = 1;
});
