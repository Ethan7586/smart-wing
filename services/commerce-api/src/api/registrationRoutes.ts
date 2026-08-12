import { encryptJson, sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { readTrustedClientIp } from './loginRateLimitBypass';
import { generateOtp, hashPassword, maskMobile, normalizeChineseMobile, phoneLookupSubject, validRegistrationPassword, verificationCodeHash } from './registrationSecurity';
import { readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { WorkerEnv } from './types';

type RegisterResult = { status?: string; memberId?: string; membershipId?: string; employeeNo?: string };

export async function handleRegistrationOtp(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (!registrationEnabled(env)) return apiError(503, 'SELF_REGISTRATION_DISABLED', '会员自主注册暂未开放', requestId);
  if (!debugSmsEnabled(env)) return apiError(503, 'SMS_PROVIDER_NOT_CONFIGURED', '短信服务尚未配置，暂不能发送验证码', requestId);
  const body = await readJsonBody(request);
  const mobile = body.ok && isRecord(body.value) ? normalizeChineseMobile(body.value.mobile) : null;
  if (!mobile) return apiError(422, 'INVALID_MOBILE', '请输入正确的11位手机号码', requestId);
  if (!env.SESSION_SIGNING_KEY || !env.IDENTITY_LOOKUP_KEY || !env.PII_ENCRYPTION_KEY) return apiError(503, 'REGISTRATION_SECURITY_NOT_CONFIGURED', '注册安全配置尚未完成', requestId);

  const challengeId = crypto.randomUUID();
  const code = generateOtp();
  const subject = await phoneLookupSubject(mobile, env.IDENTITY_LOOKUP_KEY);
  const clientIp = readTrustedClientIp(request);
  const created = await callRpc<boolean>(env, 'api_create_registration_challenge', {
    p_challenge_id: challengeId,
    p_phone_subject: subject,
    p_phone_masked: maskMobile(mobile),
    p_code_hash: await verificationCodeHash('registration', challengeId, code, env.IDENTITY_LOOKUP_KEY),
    p_ip_hash: await sha256(`${clientIp ?? 'unknown'}:${env.SESSION_SIGNING_KEY}`),
    p_expires_at: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
  });
  if (!created) return apiError(429, 'OTP_RATE_LIMITED', '验证码发送过于频繁，请稍后重试', requestId);
  return json({ challengeId, expiresInSeconds: 300, resendAfterSeconds: 60, debugCode: code, requestId });
}

export async function handleRegistration(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (!registrationEnabled(env)) return apiError(503, 'SELF_REGISTRATION_DISABLED', '会员自主注册暂未开放', requestId);
  const body = await readJsonBody(request);
  if (!body.ok || !isRecord(body.value)) return apiError(400, 'INVALID_REGISTRATION_INPUT', '注册信息不完整', requestId);
  const mobile = normalizeChineseMobile(body.value.mobile);
  const challengeId = readString(body.value.challengeId, 80);
  const code = readString(body.value.code, 6);
  const password = typeof body.value.password === 'string' ? body.value.password : '';
  const displayName = readString(body.value.displayName, 60);
  const inviteCode = readString(body.value.inviteCode, 80)?.toUpperCase();
  if (!mobile || !challengeId || !/^\d{6}$/.test(code ?? '') || !displayName || !inviteCode) {
    return apiError(422, 'INVALID_REGISTRATION_INPUT', '请完整填写手机号、验证码、姓名和企业邀请码', requestId);
  }
  if (!validRegistrationPassword(password)) return apiError(422, 'WEAK_PASSWORD', '密码至少10位，并同时包含字母和数字', requestId);
  if (!env.IDENTITY_LOOKUP_KEY || !env.PII_ENCRYPTION_KEY) return apiError(503, 'REGISTRATION_SECURITY_NOT_CONFIGURED', '注册安全配置尚未完成', requestId);

  const subject = await phoneLookupSubject(mobile, env.IDENTITY_LOOKUP_KEY);
  const result = await callRpc<RegisterResult>(env, 'api_register_storefront_member', {
    p_challenge_id: challengeId,
    p_phone_subject: subject,
    p_code_hash: await verificationCodeHash('registration', challengeId, code!, env.IDENTITY_LOOKUP_KEY),
    p_phone_masked: maskMobile(mobile),
    p_phone_cipher: JSON.parse(await encryptJson({ mobile }, env.PII_ENCRYPTION_KEY)),
    p_password_hash: await hashPassword(password),
    p_display_name: displayName,
    p_invite_code_hash: await sha256(inviteCode),
  });
  if (result?.status === 'account_exists') return apiError(409, 'ACCOUNT_ALREADY_EXISTS', '该手机号已注册，请直接登录', requestId);
  if (result?.status === 'invalid_invite') return apiError(422, 'INVALID_INVITATION', '企业邀请码无效、已过期或不适用于该手机号', requestId);
  if (result?.status !== 'active') return apiError(422, 'INVALID_OTP', '验证码不正确、已失效或尝试次数过多', requestId);
  return json({ registered: true, status: 'active', employeeNo: result.employeeNo, requestId }, { status: 201 });
}

export async function localPhoneSubject(mobile: string, env: WorkerEnv): Promise<string | null> {
  return env.IDENTITY_LOOKUP_KEY ? phoneLookupSubject(mobile, env.IDENTITY_LOOKUP_KEY) : null;
}

function registrationEnabled(env: WorkerEnv): boolean {
  return env.SELF_REGISTRATION_ENABLED === 'true' || env.APP_ENV === 'development' || env.APP_ENV === 'test';
}
function debugSmsEnabled(env: WorkerEnv): boolean {
  return (env.APP_ENV === 'development' || env.APP_ENV === 'test') && (env.SMS_PROVIDER === undefined || env.SMS_PROVIDER === 'debug');
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readString(value: unknown, maximum: number): string | null {
  const result = typeof value === 'string' ? value.trim() : '';
  return result && result.length <= maximum ? result : null;
}
