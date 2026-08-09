/**
 * 智慧翼企业福利商城 - 统一登录 LoginPage screen
 * 员工端与运营后台共用的认证、身份选择和二次验证界面。
 * 技术服务方：雍彻科技
 */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, ChevronRight, CircleAlert, Eye, EyeOff, KeyRound, LockKeyhole, MonitorCog, Phone, QrCode, RefreshCw, ShieldCheck, Smartphone, Store, UserRoundCheck } from 'lucide-react';
import { useMallContext } from '../context/MallContext';
import { loginWithOtp, loginWithPassword, requestOtp, verifyStepUp } from '../services/auth';
import type { LoginMethod, Membership, PreAuthContext } from '../types';

type Stage = 'authenticate' | 'membership' | 'step-up';

const methods: Array<{ id: LoginMethod; label: string; icon: typeof Smartphone }> = [
  { id: 'otp', label: '手机号', icon: Smartphone },
  { id: 'password', label: '企业账号', icon: KeyRound },
  { id: 'work_weixin', label: '企业微信', icon: QrCode },
  { id: 'sso', label: '企业 SSO', icon: Building2 },
];

const statusLabel: Record<Membership['status'], string> = {
  active: '可使用',
  invited: '邀请待接受',
  suspended: '已停用',
  offboarded: '已离职',
  expired: '福利周期已到期',
};

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#1F5EFF] shadow-lg shadow-blue-950/15">
      <span className="text-xl font-black italic tracking-[-0.18em]">W</span>
      <span className="ml-0.5 h-4 w-1 rounded-full bg-[#FFB000]" />
    </div>
  );
}

function StageIndicator({ stage }: { stage: Stage }) {
  const stages: Array<{ id: Stage; label: string }> = [
    { id: 'authenticate', label: '验证身份' },
    { id: 'membership', label: '选择身份' },
    { id: 'step-up', label: '安全验证' },
  ];
  const currentIndex = stages.findIndex((item) => item.id === stage);

  return (
    <ol className="mb-7 flex items-center gap-2" aria-label="登录进度">
      {stages.map((item, index) => {
        const active = index <= currentIndex;
        return (
          <li className="flex items-center gap-2" key={item.id}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-[#1F5EFF] text-white' : 'bg-slate-100 text-slate-400'}`} aria-current={index === currentIndex ? 'step' : undefined}>
              {index + 1}
            </span>
            <span className={`hidden text-xs font-semibold sm:inline ${active ? 'text-slate-700' : 'text-slate-400'}`}>{item.label}</span>
            {index < stages.length - 1 && <span className="h-px w-5 bg-slate-200 sm:w-8" />}
          </li>
        );
      })}
    </ol>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p> : null;
}

export function LoginPage() {
  const { acceptedTerms, currentDomain, navigateTo, setAcceptedTerms, setActiveSession } = useMallContext();
  const [stage, setStage] = useState<Stage>('authenticate');
  const [method, setMethod] = useState<LoginMethod>('otp');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [preAuth, setPreAuth] = useState<PreAuthContext | null>(null);
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null);

  const isAdminDomain = currentDomain === 'smart.hbbtzn.com';
  const heading = stage === 'authenticate' ? '欢迎回来' : stage === 'membership' ? '选择本次工作身份' : '完成安全验证';
  const description = stage === 'authenticate' ? '登录后选择你的企业福利或运营身份。' : stage === 'membership' ? '本次会话只使用你选择的身份与数据范围。' : '管理身份需要额外验证后才能进入运营后台。';
  const memberships = preAuth?.memberships ?? [];
  const employeeMemberships = useMemo(() => memberships.filter((item) => item.target === 'storefront'), [memberships]);
  const adminMemberships = useMemo(() => memberships.filter((item) => item.target === 'admin'), [memberships]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = window.setInterval(() => setOtpCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [otpCountdown]);

  function clearFeedback() {
    setError('');
    setFieldErrors({});
  }

  async function sendOtp() {
    clearFeedback();
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setFieldErrors({ phone: '请输入正确的 11 位手机号' });
      return;
    }
    setLoading(true);
    try {
      await requestOtp(phone);
      setOtpCountdown(60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function submitAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!acceptedTerms) {
      setError('请先阅读并同意用户协议与隐私政策。');
      return;
    }

    if (method === 'otp' && (!/^1[3-9]\d{9}$/.test(phone.trim()) || !/^\d{6}$/.test(otpCode.trim()))) {
      setFieldErrors({
        phone: /^1[3-9]\d{9}$/.test(phone.trim()) ? '' : '请输入正确的 11 位手机号',
        otpCode: /^\d{6}$/.test(otpCode.trim()) ? '' : '请输入 6 位验证码',
      });
      return;
    }
    if (method === 'password' && (!identifier.trim() || !password)) {
      setFieldErrors({
        identifier: identifier.trim() ? '' : '请输入工号或企业邮箱',
        password: password ? '' : '请输入密码',
      });
      return;
    }
    if (method === 'work_weixin' || method === 'sso') {
      setError('该企业登录方式正在接入，请使用手机号或企业账号登录。');
      return;
    }

    setLoading(true);
    try {
      const result = method === 'otp' ? await loginWithOtp(phone, otpCode) : await loginWithPassword(identifier, password);
      if (result.memberships.length === 0) {
        setError('该账号未加入任何企业福利计划，请联系企业管理员。');
        return;
      }
      setPreAuth(result);
      const activeMemberships = result.memberships.filter((item) => item.status === 'active');
      if (activeMemberships.length === 1) {
        chooseMembership(activeMemberships[0], result);
      } else {
        setStage('membership');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号或验证码不正确');
    } finally {
      setLoading(false);
    }
  }

  function chooseMembership(membership: Membership, authContext = preAuth) {
    if (membership.status !== 'active') return;
    setSelectedMembership(membership);
    setError('');
    if (membership.target === 'admin') {
      setStage('step-up');
      return;
    }
    completeStorefront(membership, authContext);
  }

  function completeStorefront(membership: Membership, authContext: PreAuthContext | null) {
    if (!authContext) return;
    setActiveSession({ membership, domain: 'hbbtzn.com' });
    navigateTo('storefront_home', { membershipId: membership.id });
  }

  async function submitStepUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!selectedMembership || !preAuth) return;
    if (!/^\d{6}$/.test(totpCode)) {
      setFieldErrors({ totpCode: '请输入 6 位动态口令' });
      return;
    }
    setLoading(true);
    try {
      const result = await verifyStepUp(preAuth.preAuthToken, selectedMembership.id, totpCode);
      setActiveSession({ membership: selectedMembership, domain: 'smart.hbbtzn.com', ticket: result.ticket });
      navigateTo('auth_callback', { membershipId: selectedMembership.id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '安全验证失败，请重新输入动态口令。');
    } finally {
      setLoading(false);
    }
  }

  function returnToAuthentication() {
    setStage('authenticate');
    setPreAuth(null);
    setSelectedMembership(null);
    setTotpCode('');
    clearFeedback();
  }

  return (
    <main className="min-h-screen p-4 text-slate-900 sm:p-8 lg:p-10">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl shadow-blue-950/10 lg:grid-cols-[0.94fr_1.06fr]">
        <aside className="relative overflow-hidden bg-[#143A8F] px-7 py-8 text-white sm:px-10 sm:py-11 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[32px] border-white/10" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#1F5EFF] opacity-70 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <p className="text-base font-black tracking-tight">智慧翼企业福利商城</p>
                <p className="mt-0.5 text-xs text-blue-100">企业福利与运营协同平台</p>
              </div>
            </div>
            <div className="mt-12 max-w-sm lg:mt-24">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                <ShieldCheck className="h-3.5 w-3.5" /> 企业级统一身份体系
              </span>
              <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                一次登录，
                <br />
                进入正确的福利空间。
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">员工福利、企业运营与商城管理使用同一身份体系；高权限操作始终需要额外验证。</p>
            </div>
          </div>
          <div className="relative mt-10 grid gap-3 sm:grid-cols-3 lg:mt-0 lg:grid-cols-1">
            {[
              { icon: UserRoundCheck, title: '身份明确', detail: '每次进入都选择当前身份' },
              { icon: LockKeyhole, title: '会话隔离', detail: '商城与后台独立保护' },
              { icon: BadgeCheck, title: '范围可控', detail: '权限仅作用于已授权资源' },
            ].map(({ icon: Icon, title, detail }) => (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/8 p-3" key={title}>
                <Icon className="h-4 w-4 shrink-0 text-[#FFCC4D]" />
                <div>
                  <p className="text-xs font-bold">{title}</p>
                  <p className="mt-0.5 text-[11px] text-blue-100">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="relative mt-7 text-[11px] text-blue-200">技术服务方：雍彻科技</p>
        </aside>

        <div className="flex items-center justify-center px-5 py-8 sm:px-10 sm:py-12">
          <div className="w-full max-w-[470px]">
            <div className="mb-8 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${isAdminDomain ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-blue-50 text-[#1F5EFF] ring-1 ring-blue-100'}`}>
                {isAdminDomain ? <MonitorCog className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                {isAdminDomain ? '运营后台入口' : '员工福利入口'}
              </span>
              <span className="text-xs font-medium text-slate-400">{currentDomain}</span>
            </div>
            <StageIndicator stage={stage} />
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{heading}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>

            {error && (
              <div className="mt-5 flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {stage === 'authenticate' && (
              <form className="mt-7" onSubmit={submitAuthentication} noValidate>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="登录方式">
                  {methods.map(({ id, label, icon: Icon }) => (
                    <button
                      className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-bold transition ${method === id ? 'bg-white text-[#1F5EFF] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      key={id}
                      onClick={() => {
                        clearFeedback();
                        setMethod(id);
                      }}
                      role="tab"
                      type="button"
                      aria-selected={method === id}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  {method === 'otp' && (
                    <>
                      <label className="block text-sm font-bold text-slate-700">
                        手机号码
                        <div className="relative mt-2">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1F5EFF]"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            inputMode="tel"
                            placeholder="请输入手机号码"
                            autoComplete="tel"
                          />
                        </div>
                        <FieldError message={fieldErrors.phone} />
                      </label>
                      <label className="block text-sm font-bold text-slate-700">
                        短信验证码
                        <div className="relative mt-2">
                          <input
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 pr-28 text-sm tracking-[0.18em] outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#1F5EFF]"
                            value={otpCode}
                            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            inputMode="numeric"
                            placeholder="6 位验证码"
                            autoComplete="one-time-code"
                          />
                          <button className="absolute right-2 top-2 rounded-lg px-2 py-1.5 text-xs font-bold text-[#1F5EFF] hover:bg-blue-50 disabled:text-slate-400" onClick={sendOtp} type="button" disabled={loading || otpCountdown > 0}>
                            {otpCountdown ? `${otpCountdown}s 后重发` : '获取验证码'}
                          </button>
                        </div>
                        <FieldError message={fieldErrors.otpCode} />
                      </label>
                    </>
                  )}

                  {method === 'password' && (
                    <>
                      <label className="block text-sm font-bold text-slate-700">
                        工号或企业邮箱
                        <input
                          className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1F5EFF]"
                          value={identifier}
                          onChange={(event) => setIdentifier(event.target.value)}
                          placeholder="请输入工号或企业邮箱"
                          autoComplete="username"
                        />
                        <FieldError message={fieldErrors.identifier} />
                      </label>
                      <label className="block text-sm font-bold text-slate-700">
                        密码
                        <div className="relative mt-2">
                          <input
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1F5EFF]"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="请输入密码"
                            autoComplete="current-password"
                          />
                          <button
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            aria-label={showPassword ? '隐藏密码' : '显示密码'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <FieldError message={fieldErrors.password} />
                      </label>
                    </>
                  )}

                  {(method === 'work_weixin' || method === 'sso') && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-center">
                      {method === 'work_weixin' ? <QrCode className="mx-auto h-8 w-8 text-slate-500" /> : <Building2 className="mx-auto h-8 w-8 text-slate-500" />}
                      <p className="mt-3 text-sm font-bold text-slate-700">{method === 'work_weixin' ? '企业微信登录' : '企业单点登录'}正在接入</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">请先使用手机号或企业账号登录；接入完成后会在此处提供企业专属入口。</p>
                    </div>
                  )}
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-500">
                  <input className="mt-1 h-3.5 w-3.5 accent-[#1F5EFF]" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" />
                  <span>
                    我已阅读并同意{' '}
                    <button className="font-semibold text-[#1F5EFF] hover:underline" type="button">
                      《用户协议》
                    </button>{' '}
                    与{' '}
                    <button className="font-semibold text-[#1F5EFF] hover:underline" type="button">
                      《隐私政策》
                    </button>
                  </span>
                </label>
                <button
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F5EFF] text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#174AD0] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  type="submit"
                  disabled={loading || !acceptedTerms}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      继续 <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <div className="mt-5 flex items-center justify-between text-xs">
                  <button className="font-semibold text-slate-500 hover:text-[#1F5EFF]" type="button">
                    忘记密码
                  </button>
                  <span className="text-slate-400">统一身份认证 · 安全登录</span>
                </div>
              </form>
            )}

            {stage === 'membership' && (
              <div className="mt-7">
                {employeeMemberships.length > 0 && <MembershipGroup title="我的福利商城" items={employeeMemberships} onChoose={chooseMembership} />}
                {adminMemberships.length > 0 && <MembershipGroup title="我管理的业务空间" items={adminMemberships} onChoose={chooseMembership} />}
                <button className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#1F5EFF]" onClick={returnToAuthentication} type="button">
                  <ArrowLeft className="h-4 w-4" /> 返回重新登录
                </button>
              </div>
            )}

            {stage === 'step-up' && selectedMembership && (
              <form className="mt-7" onSubmit={submitStepUp} noValidate>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-sm font-bold text-amber-950">即将进入运营后台</p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        {selectedMembership.enterpriseName} · {selectedMembership.roleName}
                      </p>
                    </div>
                  </div>
                </div>
                <label className="mt-5 block text-sm font-bold text-slate-700">
                  动态口令（TOTP）
                  <input
                    className="mt-2 h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-xl font-bold tracking-[0.4em] outline-none transition focus:border-[#1F5EFF]"
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                  />
                  <FieldError message={fieldErrors.totpCode} />
                </label>
                <p className="mt-3 text-xs leading-5 text-slate-500">验证通过后会签发仅限后台域使用的短时会话；系统不会在浏览器本地保存票据。</p>
                <button
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#143A8F] text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:bg-[#102F73] disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      验证并进入后台 <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <button
                  className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#1F5EFF]"
                  onClick={() => {
                    setStage('membership');
                    setTotpCode('');
                    clearFeedback();
                  }}
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" /> 选择其他身份
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function MembershipGroup({ title, items, onChoose }: { title: string; items: Membership[]; onChoose: (membership: Membership) => void }) {
  return (
    <section className="mt-5 first:mt-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <div className="space-y-2">
        {items.map((membership) => {
          const enabled = membership.status === 'active';
          const isAdmin = membership.target === 'admin';
          return (
            <button
              className={`w-full rounded-2xl border p-4 text-left transition ${enabled ? 'border-slate-200 bg-white hover:border-[#1F5EFF] hover:shadow-md hover:shadow-blue-950/5' : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-65'}`}
              key={membership.id}
              onClick={() => onChoose(membership)}
              type="button"
              disabled={!enabled}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isAdmin ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-[#1F5EFF]'}`}>
                    {isAdmin ? <MonitorCog className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{membership.storeName}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{membership.enterpriseName}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{statusLabel[membership.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-600">{membership.roleName}</span>
                <span className="text-slate-500">{membership.dataScope}</span>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 font-semibold text-amber-800">
                    <ShieldCheck className="h-3 w-3" /> 需二次验证
                  </span>
                )}
              </div>
              {membership.keyPermissions && <p className="mt-2 truncate font-mono text-[10px] text-slate-400">{membership.keyPermissions.join(' · ')}</p>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
