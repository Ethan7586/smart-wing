/**
 * 智慧翼企业福利商城 - 统一登录 LoginPage screen
 * 员工端（hbbtzn.com）与运营后台（smart.hbbtzn.com）共用同一份登录页组件，两域分别部署
 * 技术服务方：雍彻科技
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Smartphone,
  QrCode,
  Globe,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  UserCheck,
  ChevronRight,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
  Store,
  CreditCard,
  UserX,
  FileText,
  X,
} from 'lucide-react';
import { useMallContext } from '../context/MallContext';
import { LoginMethod, Membership, PreAuthContext } from '../types';
import { requestOtp, loginWithOtp, loginWithPassword, verifyStepUp, getLockoutState, acceptInvitation, changeInitialPassword, registerUsernameMember } from '../services/auth';

export const LoginPage: React.FC = () => {
  const { currentDomain, navigateTo, acceptedTerms, setAcceptedTerms, setActiveSession } = useMallContext();
  const isStorefrontEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'storefront';

  // 当前流程阶段: 1 = 账号认证, 2 = 选择会员身份, 3 = 管理员 Step-Up 二次验证
  const [stage, setStage] = useState<1 | 2 | 3>(1);

  // Tab 状态: 'otp' | 'password' | 'work_weixin' | 'sso'
  const [activeTab, setActiveTab] = useState<LoginMethod>('password');

  // 表单受控字段
  const [phone, setPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [ssoDomain, setSsoDomain] = useState<string>('tencent.hbbtzn.com');
  const [totpCode, setTotpCode] = useState<string>('123456');
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registration, setRegistration] = useState({ username: '', displayName: '', inviteCode: '', password: '', confirmPassword: '' });
  const [registrationNotice, setRegistrationNotice] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetForm, setResetForm] = useState({ mobile: '', code: '', challengeId: '', password: '', confirm: '' });

  // UI 视觉交互状态
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 倒计时状态
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // 认证返回的短时效 PreAuth 上下文（前端不持久化至 localStorage/sessionStorage）
  const [preAuthContext, setPreAuthContext] = useState<PreAuthContext | null>(null);

  // 选中的 Membership
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null);

  // 扫码体验状态：等待扫码 → 已扫码待手机确认 → 已确认 → 失效刷新
  const [qrStatus, setQrStatus] = useState<'pending_scan' | 'scanned' | 'confirmed' | 'expired'>('pending_scan');
  const [qrCountdown, setQrCountdown] = useState<number>(180);
  const [qrLoginChannel, setQrLoginChannel] = useState<'work_weixin' | 'wechat'>('work_weixin');

  const switchQrLoginChannel = () => {
    setQrLoginChannel((current) => (current === 'work_weixin' ? 'wechat' : 'work_weixin'));
    setQrStatus('pending_scan');
    setQrCountdown(180);
  };

  const continueFromQrConfirmation = () => {
    const context: PreAuthContext = {
      preAuthToken: `PAT_QR_${Date.now()}`,
      phone: '13800138000',
      loginMethod: 'work_weixin',
      memberships: [
        {
          id: 'mem_qr_storefront',
          target: 'storefront',
          status: 'active',
          enterpriseName: '腾讯科技（深圳）有限公司',
          storeName: '智慧翼·员工福利专区',
          roleName: qrLoginChannel === 'work_weixin' ? '企业微信认证员工' : '微信认证员工',
          dataScope: '个人福利账户',
          accountTypeLabel: '福利账户',
        },
        {
          id: 'mem_qr_admin',
          target: 'admin',
          status: 'active',
          enterpriseName: '腾讯科技（深圳）有限公司',
          storeName: '智慧翼·企业福利运营后台',
          roleName: '企业福利管理员',
          dataScope: '本企业福利专区',
          subjectScope: '企业',
          keyPermissions: ['order.refund', 'audit.read'],
          authorizedBy: '企业福利负责人',
          expireAt: '2027-12-31',
          requiresStepUp: true,
        },
      ],
    };

    setPreAuthContext(context);
    setStage(2);
  };

  // 协议弹窗
  const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | null>(null);

  // 首次登录修改密码模拟控制
  const [showForcePasswordModal, setShowForcePasswordModal] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');

  // 处理 lockout 倒计时
  useEffect(() => {
    let timer: any;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // 处理 OTP 倒计时
  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // 处理二维码倒计时
  useEffect(() => {
    let timer: any;
    if (activeTab === 'work_weixin' && qrStatus === 'pending_scan' && qrCountdown > 0) {
      timer = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            setQrStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTab, qrStatus, qrCountdown]);

  // 处理手机号变更时检查锁定
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    setFormError('');
    setFieldErrors((prev) => ({ ...prev, phone: '' }));
    const lock = getLockoutState(val.trim());
    if (lock.isLocked) {
      setLockoutSeconds(lock.remainingSeconds);
    }
  };

  const handleIdentifierChange = (val: string) => {
    setIdentifier(val);
    setFormError('');
    setFieldErrors((prev) => ({ ...prev, identifier: '' }));
    const lock = getLockoutState(val.trim());
    if (lock.isLocked) {
      setLockoutSeconds(lock.remainingSeconds);
    }
  };

  // 校验第一段表单
  const validateStage1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (activeTab === 'otp') {
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
        errors.phone = '请输入正确的11位手机号码';
      }
      if (!/^\d{6}$/.test(otpCode.trim())) {
        errors.otpCode = '请输入6位短信验证码';
      }
    } else if (activeTab === 'password') {
      if (!identifier.trim()) {
        errors.identifier = '请输入登录账号或已绑定手机号';
      }
      if (!password.trim()) {
        errors.password = '请输入密码';
      }
    } else if (activeTab === 'sso') {
      if (!ssoDomain.trim()) {
        errors.ssoDomain = '请输入企业专属域名或邀请码';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 发送短信验证码
  const handleSendOtp = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setFieldErrors((prev) => ({ ...prev, phone: '请输入正确的11位手机号码' }));
      return;
    }
    setLoading(true);
    setFormError('');
    try {
      await requestOtp(phone);
      setOtpCountdown(60);
    } catch (err: any) {
      setFormError(err.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  const updateRegistration = (field: keyof typeof registration, value: string) => {
    setRegistration((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const handleRegistrationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!acceptedTerms) return setFormError('请先阅读并同意用户协议和隐私政策');
    if (registration.password !== registration.confirmPassword) return setFormError('两次输入的密码不一致');
    setLoading(true);
    setFormError('');
    try {
      await registerUsernameMember({
        username: registration.username.trim(),
        password: registration.password,
        displayName: registration.displayName.trim(),
        inviteCode: registration.inviteCode.trim(),
        acceptedTerms: true,
      });
      setIdentifier(registration.username.trim().toLowerCase());
      setPassword(registration.password);
      setActiveTab('password');
      setRegistrationOpen(false);
      setRegistrationNotice('');
      setFormError('注册成功。已建立基础会员身份；手机尚未验证，可登录和浏览，短信认证完成前暂不能提交订单或付款。');
    } catch (error: any) {
      setFormError(error.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async () => {
    setLoading(true);
    setFormError('');
    try {
      const response = await fetch('/api/v1/auth/security/otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mobile: resetForm.mobile, purpose: 'password_reset' }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || '验证码发送失败');
      setResetForm((current) => ({ ...current, challengeId: payload.challengeId, code: payload.debugCode ?? current.code }));
      setRegistrationNotice(payload.debugCode ? `开发环境验证码：${payload.debugCode}` : '验证码已发送');
    } catch (error: any) {
      setFormError(error.message || '验证码发送失败');
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resetForm.password !== resetForm.confirm) return setFormError('两次输入的新密码不一致');
    setLoading(true);
    setFormError('');
    try {
      const response = await fetch('/api/v1/auth/password/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mobile: resetForm.mobile, challengeId: resetForm.challengeId, code: resetForm.code, newPassword: resetForm.password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || '密码重置失败');
      setIdentifier(resetForm.mobile);
      setPassword(resetForm.password);
      setResetOpen(false);
      setRegistrationNotice('');
      setFormError('密码已重置，所有旧设备均已下线，请重新登录。');
    } catch (error: any) {
      setFormError(error.message || '密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  // 1. 提交第一段认证
  const handleStage1Submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!acceptedTerms) {
      setFormError('请先阅读并勾选《用户协议》和《隐私政策》');
      return;
    }
    if (!validateStage1()) return;

    setLoading(true);
    setFormError('');

    try {
      let context: PreAuthContext;
      if (activeTab === 'otp') {
        context = await loginWithOtp(phone, otpCode);
      } else if (activeTab === 'password') {
        context = await loginWithPassword(identifier, password);
      } else {
        throw new Error('当前登录方式暂未配置，请使用手机验证码或工号登录');
      }

      // 如果需要重置密码
      if (context.requiresPasswordReset) {
        setPreAuthContext(context);
        setShowForcePasswordModal(true);
        setLoading(false);
        return;
      }

      setPreAuthContext(context);
      await processPreAuthContext(context);
    } catch (err: any) {
      setFormError(err.message || '认证失败');
      // 检查是否触发锁定
      const targetId = activeTab === 'otp' ? phone : identifier;
      const lock = getLockoutState(targetId);
      if (lock.isLocked) {
        setLockoutSeconds(lock.remainingSeconds);
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理 PreAuth 上下文并路由到第2段或自动跳转
  const completeEmbeddedStorefrontLogin = async (membershipId: string) => {
    // Credential discovery never creates a cookie. The final login is the only
    // place that establishes the tracked, revocable HttpOnly device session.
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: identifier, password }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message || '登录失败，请检查测试账号与密码');
    }

    // iframe 与商城同源；只通知父窗口刷新已建立的 HttpOnly 会话，不传递密码或票据。
    window.parent.postMessage({ type: 'smart-wing:storefront-login-complete', membershipId }, window.location.origin);
  };

  const completeAdminTestLogin = () => {
    // The browser performs a top-level POST on the target host, allowing the
    // admin domain to create its own __Host- cookie before loading the app.
    // Credentials are deliberately submitted in the request body, never URL.
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://smart.hbbtzn.com/api/v1/auth/login?redirect=/';
    // When the login page is rendered in the storefront drawer, the form must
    // escape that iframe; otherwise the whole admin app is rendered in-panel.
    form.target = '_top';
    form.style.display = 'none';
    for (const [name, value] of Object.entries({ username: identifier, password })) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  };

  const processPreAuthContext = async (context: PreAuthContext) => {
    const activeMemberships = context.memberships;

    // 如果没有任何可用会员身份
    if (!activeMemberships || activeMemberships.length === 0) {
      setStage(2);
      return;
    }

    // 筛选可进行单身份自动跳过的有效身份
    const validMemberships = activeMemberships.filter((m) => m.status === 'active' || m.status === 'invited');

    // 仅有 1 条会员关系时自动跳过第2段
    if (validMemberships.length === 1) {
      const singleMem = validMemberships[0];
      if (singleMem.target === 'storefront' && singleMem.status === 'active') {
        if (isStorefrontEmbed && activeTab === 'password') {
          await completeEmbeddedStorefrontLogin(singleMem.id);
          return;
        }
        // 员工端单身份，无需 step-up，直接登录成功
        setActiveSession({
          membership: singleMem,
          domain: 'hbbtzn.com',
        });
        navigateTo('storefront_home', { membershipId: singleMem.id });
        return;
      } else if (singleMem.target === 'admin') {
        if (singleMem.requiresStepUp) {
          // 管理身份需 Step-Up，自动进入第3段
          setSelectedMembership(singleMem);
          setStage(3);
        } else {
          completeAdminTestLogin();
        }
        return;
      }
    }

    // 多条身份或包含复杂状态，进入第2段选择会员关系
    setStage(2);
  };

  // 2. 选中并确认某条会员关系
  const handleSelectMembership = async (mem: Membership) => {
    if (mem.status === 'invited') {
      setFormError(`【${mem.enterpriseName}】的邀请尚待接受，请先确认加入该企业福利计划`);
      return;
    }
    if (mem.status === 'suspended') {
      setFormError(`【${mem.enterpriseName}】访问权已被停用，请联系企业管理员解封`);
      return;
    }
    if (mem.status === 'offboarded') {
      setFormError(`【${mem.enterpriseName}】员工状态显示为已离职，访问权已归档回收`);
      return;
    }
    if (mem.status === 'expired') {
      setFormError(`【${mem.enterpriseName}】福利周期已届满到期`);
      return;
    }

    setFormError('');
    setSelectedMembership(mem);

    if (mem.target === 'admin' && mem.requiresStepUp) {
      // 进入第三段 Step-Up 二次验证
      setStage(3);
    } else {
      // 嵌入员工商城时，认证页只负责完成身份选择；不在右侧抽屉渲染另一套商城。
      if (isStorefrontEmbed && mem.target === 'storefront') {
        await completeEmbeddedStorefrontLogin(mem.id);
        return;
      }

      if (mem.target === 'admin') {
        completeAdminTestLogin();
        return;
      }

      // 普通员工卡片直接进入商城
      setActiveSession({
        membership: mem,
        domain: 'hbbtzn.com',
      });

      navigateTo('storefront_home', { membershipId: mem.id });
    }
  };

  // 处理接受邀请按钮
  const handleAcceptInvite = async (e: React.MouseEvent, mem: Membership) => {
    e.stopPropagation();
    setLoading(true);
    try {
      if (preAuthContext) {
        await acceptInvitation(preAuthContext.preAuthToken, mem.id);
        // 本地改写状态为 active
        mem.status = 'active';
        await handleSelectMembership(mem);
      }
    } catch (err: any) {
      setFormError('接受邀请失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 3. 提交第3段 Step-Up 二次验证
  const handleStepUpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!totpCode || totpCode.trim().length !== 6) {
      setFieldErrors({ totpCode: '请输入6位动态口令' });
      return;
    }

    setLoading(true);
    setFormError('');

    try {
      if (!preAuthContext || !selectedMembership) {
        throw new Error('认证上下文已失效，请返回重新登录');
      }

      // 验证 Step-Up，获取一次性票据 Ticket
      const result = await verifyStepUp(preAuthContext.preAuthToken, selectedMembership.id, totpCode);

      if (selectedMembership.target === 'admin') {
        completeAdminTestLogin();
        return;
      }

      // 从员工商城抽屉进入后台时，交由父页面切换至独立的 smart 域。
      if (isStorefrontEmbed) {
        window.parent.postMessage(
          {
            type: 'smart-wing:admin-login-complete',
            redirectUrl: result.redirectUrl,
          },
          window.location.origin
        );
        return;
      }

      // 安全红线校验：票据绝不落盘写 localStorage/sessionStorage
      // 前端做无痕全页跳转或模拟回调跳转
      navigateTo('auth_callback', {
        ticket: result.ticket,
        targetDomain: result.targetDomain,
        redirectUrl: result.redirectUrl,
        membership: selectedMembership,
      });
    } catch (err: any) {
      setFormError(err.message || '二次验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 返回上一步
  const handleGoBack = () => {
    setFormError('');
    if (stage === 3) {
      setTotpCode('');
      setStage(2);
    } else if (stage === 2) {
      setOtpCode('');
      setStage(1);
    }
  };

  // 快速测试填入账号工具
  const quickFillAccount = (testPhone: string, testPass: string = '123456') => {
    setPhone(testPhone);
    setIdentifier(testPhone);
    setPassword(testPass);
    setOtpCode('123456');
    setFormError('');
    setFieldErrors({});
    const lock = getLockoutState(testPhone);
    if (lock.isLocked) {
      setLockoutSeconds(lock.remainingSeconds);
    }
  };

  const handleMembershipKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, membership: Membership) => {
    if ((event.key === 'Enter' || event.key === ' ') && membership.status === 'active') {
      event.preventDefault();
      void handleSelectMembership(membership);
    }
  };

  // 计算多条会员关系的分类与排序（遵从域优先原则）
  const renderMembershipsList = () => {
    if (!preAuthContext) return null;
    const allMemberships = preAuthContext.memberships || [];

    if (allMemberships.length === 0) {
      return (
        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
          <UserX className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-800 mb-1">未找到关联的企业福利计划</h4>
          <p className="text-xs text-slate-5-00 text-slate-500 mb-4 max-w-sm mx-auto">该账号当前未被录入任何企业的福利发放名单或运营后台。请联系您所在企业的 HR 或福利管理员进行绑定。</p>
          <button
            onClick={() => {
              setStage(1);
              setFormError('');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[var(--sw-brand)] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            切换其他账号登录
          </button>
        </div>
      );
    }

    const storefrontItems = allMemberships.filter((m) => m.target === 'storefront');
    const adminItems = allMemberships.filter((m) => m.target === 'admin');

    // 依据当前所在域决定排列先后顺序：smart.hbbtzn.com 运营后台优先显示管理身份
    const isSmartDomain = currentDomain === 'smart.hbbtzn.com';

    const renderStorefrontSection = () => (
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-[var(--sw-brand)]" />
            <h4 className="text-xs font-bold text-slate-700 tracking-wider uppercase">我的福利商城</h4>
          </div>
          <span className="text-[11px] text-slate-400">共 {storefrontItems.length} 个专区</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5">
          {storefrontItems.map((mem) => {
            const isInvalid = mem.status === 'suspended' || mem.status === 'offboarded' || mem.status === 'expired';
            return (
              <div
                key={mem.id}
                onClick={() => mem.status === 'active' && void handleSelectMembership(mem)}
                onKeyDown={(event) => handleMembershipKeyDown(event, mem)}
                role="button"
                tabIndex={mem.status === 'active' ? 0 : -1}
                aria-disabled={mem.status !== 'active'}
                aria-label={`进入 ${mem.storeName}，${mem.enterpriseName}，${mem.roleName}`}
                className={`group relative p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isInvalid ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-[var(--sw-brand)] hover:shadow-md hover:bg-blue-50/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800 truncate">{mem.storeName}</span>
                      {mem.accountTypeLabel && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-[var(--sw-brand)] rounded-md border border-blue-100">
                          <CreditCard className="w-2.5 h-2.5" />
                          {mem.accountTypeLabel}
                        </span>
                      )}
                      {mem.status === 'invited' && <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-md border border-amber-200">邀请待接受</span>}
                    </div>
                    <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      {mem.enterpriseName} · {mem.roleName}
                    </div>
                  </div>

                  {mem.status === 'invited' ? (
                    <button onClick={(e) => handleAcceptInvite(e, mem)} className="shrink-0 px-3 py-1 text-xs font-medium bg-[var(--sw-brand)] text-white rounded-lg hover:bg-[var(--sw-brand-dark)] transition-colors">
                      接受邀请
                    </button>
                  ) : (
                    <div className="shrink-0 pt-1 text-slate-300 group-hover:text-[var(--sw-brand)] transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* 特殊状态提示 */}
                {mem.status === 'suspended' && (
                  <p className="mt-2 text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> 该身份已被停用，请联系企业 HR
                  </p>
                )}
                {mem.status === 'offboarded' && (
                  <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                    <UserX className="w-3 h-3" /> 状态显示为离职，访问权已回收
                  </p>
                )}
                {mem.status === 'expired' && (
                  <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 福利周期已到期
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    const renderAdminSection = () => (
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--sw-brand-dark)]" />
            <h4 className="text-xs font-bold text-slate-700 tracking-wider uppercase">我管理的运营主体</h4>
          </div>
          <span className="text-[11px] text-slate-400">共 {adminItems.length} 项管理权限</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5">
          {adminItems.map((mem) => {
            return (
              <div
                key={mem.id}
                onClick={() => mem.status === 'active' && void handleSelectMembership(mem)}
                onKeyDown={(event) => handleMembershipKeyDown(event, mem)}
                role="button"
                tabIndex={mem.status === 'active' ? 0 : -1}
                aria-disabled={mem.status !== 'active'}
                aria-label={`进入运营后台：${mem.enterpriseName}，${mem.roleName}`}
                className="group p-3.5 rounded-xl border border-slate-200 bg-slate-900 text-white hover:border-[var(--sw-brand)] hover:ring-2 hover:ring-[var(--sw-brand)]/30 transition-all cursor-pointer shadow-sm relative overflow-hidden"
              >
                {/* 顶部微渐变条 */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--sw-brand)] to-[var(--sw-brand-dark)]" />

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-100">{mem.enterpriseName}</span>
                      {mem.subjectScope && <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-800 text-blue-300 rounded border border-slate-700">{mem.subjectScope}级</span>}
                      {mem.requiresStepUp && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 rounded border border-amber-500/40">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          需二次验证
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 font-medium">
                      {mem.roleName} · {mem.storeName}
                    </p>
                    <p className="text-[11px] text-slate-400">数据范围: {mem.dataScope}</p>

                    {/* 关键权限徽章 */}
                    {mem.keyPermissions && mem.keyPermissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1.5">
                        {mem.keyPermissions.map((perm) => (
                          <span key={perm} className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                            {perm}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-3">
                      {mem.authorizedBy && <span>授权人: {mem.authorizedBy}</span>}
                      {mem.expireAt && <span>有效期至: {mem.expireAt}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 pt-1 text-slate-500 group-hover:text-[var(--sw-brand)] transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
        {isSmartDomain ? (
          <>
            {adminItems.length > 0 && renderAdminSection()}
            {storefrontItems.length > 0 && renderStorefrontSection()}
          </>
        ) : (
          <>
            {storefrontItems.length > 0 && renderStorefrontSection()}
            {adminItems.length > 0 && renderAdminSection()}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`${isStorefrontEmbed ? 'min-h-screen bg-transparent' : 'min-h-screen bg-slate-50 flex flex-col justify-between'} selection:bg-blue-100 selection:text-[var(--sw-brand)]`}>
      {/* 顶部体验演示与调试工具条 */}
      {!isStorefrontEmbed && (
        <div className="bg-slate-900 text-slate-300 text-xs px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px] font-semibold border border-blue-500/30">
              <Globe className="w-3 h-3" />
              当前访问域: {currentDomain}
            </span>
            <span className="text-slate-400 hidden sm:inline">| 两域共用同一套统一登录组件，根据域名智能调整排序与跳转行为</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">快速填入测试账号:</span>
            <button onClick={() => quickFillAccount('buyer001')} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors">
              买家 buyer001
            </button>
            <button onClick={() => quickFillAccount('seller001')} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors">
              商家 seller001
            </button>
            <button onClick={() => quickFillAccount('ops001')} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors">
              运营 ops001
            </button>
            <button onClick={() => quickFillAccount('cs001')} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors">
              客服 cs001
            </button>
            <button onClick={() => quickFillAccount('admin001')} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] transition-colors">
              管理员 admin001
            </button>
          </div>
        </div>
      )}

      {/* 主布局：认证卡片叠压在蓝色品牌底板上（桌面端覆盖约 80%） */}
      <div className={isStorefrontEmbed ? 'flex min-h-screen items-center justify-center bg-transparent p-0' : 'flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12'}>
        <div className={`relative w-full max-w-[520px] rounded-3xl bg-gradient-to-br from-[var(--sw-brand)] to-[var(--sw-brand-dark)] shadow-xl ${isStorefrontEmbed ? 'overflow-visible p-3' : 'overflow-hidden'}`}>
          {isStorefrontEmbed && (
            <button
              type="button"
              aria-label="关闭统一账号认证"
              className="absolute -right-5 -top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl leading-none text-slate-600 shadow-lg transition hover:text-slate-950"
              onClick={() => window.parent.postMessage({ type: 'smart-wing:close-login-drawer' }, window.location.origin)}
            >
              ×
            </button>
          )}
          {/* 蓝色品牌底板 */}
          <div className={isStorefrontEmbed ? 'hidden' : 'min-h-[420px] p-8 text-white sm:p-12 lg:min-h-[606px] lg:pr-12'}>
            {/* 装饰模糊背景光晕 */}
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

            {/* 顶部 Logo 品牌 */}
            <div className="relative z-10 flex items-center gap-3">
              <img src="./brand/brand-mark.svg" alt="" className="h-12 w-12 shrink-0 rounded-2xl shadow-md" />
              <div>
                <span className="text-2xl font-bold tracking-tight text-white block">智慧翼 Smart Wing</span>
                <span className="text-[10px] font-semibold tracking-widest text-blue-200 uppercase">Enterprise Benefits</span>
              </div>
            </div>

            {/* 中间 醒目粗体大标题与描述 */}
            <div className="relative z-10 my-8">
              <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tighter opacity-95 text-white">
                企业福利
                <br />
                全新定义
              </h1>
              <p className="mt-4 text-blue-100/90 text-sm sm:text-base leading-relaxed max-w-[280px]">连接员工与企业的智慧桥梁，提供更有温度的数字福利体验。</p>
            </div>

            {/* 底部 技术服务方标识 */}
            <div className="relative z-10 pt-6 border-t border-white/15 space-y-1">
              <div className="text-[10px] font-medium tracking-widest opacity-60 uppercase text-blue-100">技术服务方</div>
              <div className="text-xs sm:text-sm font-semibold tracking-wide text-white">雍彻科技 YONGCHE TECH</div>
            </div>
          </div>

          {/* 认证卡：桌面端由右向左叠压蓝色底板的 80% 区域 */}
          <div className={isStorefrontEmbed ? 'relative z-10 w-full p-0' : `relative z-10 p-4 sm:p-6 lg:absolute lg:inset-y-6 lg:right-6 lg:flex lg:items-center lg:p-0 ${stage === 2 ? 'lg:w-[560px]' : 'lg:w-[460px]'}`}>
            <div className="w-full overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl transition-all duration-300">
              {/* 卡片顶部：三段式进度指示器 (Bold Typography 风格) */}
              <div className="bg-slate-50/80 px-6 sm:px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {stage > 1 && (
                    <button onClick={handleGoBack} className="p-1.5 mr-1 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors" aria-label="返回上一阶段">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  {/* 步骤 1 */}
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stage >= 1 ? 'bg-[var(--sw-brand)] text-white shadow-sm' : 'border-2 border-slate-200 text-slate-400'}`}>1</div>
                  <div className={`w-6 sm:w-8 h-[2px] ${stage >= 2 ? 'bg-[var(--sw-brand)]' : 'bg-slate-200'}`} />

                  {/* 步骤 2 */}
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${
                      stage > 2 ? 'bg-[var(--sw-brand)] text-white shadow-sm' : stage === 2 ? 'border-2 border-[var(--sw-brand)] text-[var(--sw-brand)] bg-white font-black' : 'border-2 border-slate-200 text-slate-400'
                    }`}
                  >
                    2
                  </div>
                  <div className={`w-6 sm:w-8 h-[2px] ${stage >= 3 ? 'bg-[var(--sw-brand)]' : 'bg-slate-200'}`} />

                  {/* 步骤 3 */}
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stage === 3 ? 'border-2 border-[var(--sw-brand)] text-[var(--sw-brand)] bg-white font-black' : 'border-2 border-slate-200 text-slate-400'}`}
                  >
                    3
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <img src="./brand/brand-mark.svg" alt="" className="h-5 w-5 rounded-md" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    {stage === 1 && '账号认证'}
                    {stage === 2 && '选择访问身份'}
                    {stage === 3 && '二次验证'}
                  </span>
                </div>
              </div>

              {/* 卡片主内容区 */}
              <div className="p-6 sm:p-8">
                {/* 阶段标题 */}
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {stage === 1 && '统一账号认证'}
                    {stage === 2 && '选择关联会员关系'}
                    {stage === 3 && '管理身份二次验证 (Step-Up)'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {stage === 1 && '请选择适合您的登录方式与身份核验'}
                    {stage === 2 && '检测到您有多个关联账号，请选择需要进入的主体：'}
                    {stage === 3 && '即将进入高权限运营后台，请进行 TOTP 动态口令二次验签'}
                  </p>
                </div>

                {/* 全局锁定/错误信息通告 Banner */}
                {lockoutSeconds > 0 && (
                  <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <div className="space-y-0.5">
                      <p className="font-semibold">连续失败次数过多，账号已触发安全锁定</p>
                      <p className="text-[11px] text-rose-600">
                        请在 <span className="font-mono font-bold">{lockoutSeconds}</span> 秒后重试。
                      </p>
                    </div>
                  </div>
                )}

                {formError && lockoutSeconds === 0 && (
                  <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <p className="flex-1">{formError}</p>
                  </div>
                )}

                {/* 第一段：认证段 (4 Tabs) */}
                {stage === 1 && (
                  <div className="flex h-[426px] flex-col gap-5">
                    {/* Tab 导航 */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium" role="tablist" aria-label="登录方式">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('otp');
                          setFormError('');
                        }}
                        disabled
                        className={`py-2 px-1 rounded-lg transition-all text-center opacity-50 cursor-not-allowed ${activeTab === 'otp' ? 'bg-white text-[var(--sw-brand)] font-bold shadow-sm' : 'text-slate-600'}`}
                        role="tab"
                        aria-selected={activeTab === 'otp'}
                        aria-controls="login-method-panel"
                        aria-label="手机验证码登录"
                      >
                        验证码（待接入）
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('password');
                          setFormError('');
                        }}
                        className={`py-2 px-1 rounded-lg transition-all text-center ${activeTab === 'password' ? 'bg-white text-[var(--sw-brand)] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        role="tab"
                        aria-selected={activeTab === 'password'}
                        aria-controls="login-method-panel"
                        aria-label="密码登录"
                      >
                        密码登录
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('work_weixin');
                          setFormError('');
                        }}
                        className={`py-2 px-1 rounded-lg transition-all text-center ${activeTab === 'work_weixin' ? 'bg-white text-[var(--sw-brand)] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        role="tab"
                        aria-selected={activeTab === 'work_weixin'}
                        aria-controls="login-method-panel"
                        aria-label={qrLoginChannel === 'wechat' ? '微信扫码' : '企业微信扫码'}
                      >
                        {qrLoginChannel === 'wechat' ? '微信扫码' : '企微扫码'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('sso');
                          setFormError('');
                        }}
                        className={`py-2 px-1 rounded-lg transition-all text-center ${activeTab === 'sso' ? 'bg-white text-[var(--sw-brand)] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        role="tab"
                        aria-selected={activeTab === 'sso'}
                        aria-controls="login-method-panel"
                        aria-label="企业SSO单点登录"
                      >
                        企业 SSO
                      </button>
                    </div>

                    <div id="login-method-panel" role="tabpanel" aria-live="polite">
                      {/* Tab 1: 手机号 + 短信验证码 */}
                      {activeTab === 'otp' && (
                        <form onSubmit={handleStage1Submit} className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-slate-400" /> 手机号码
                            </label>
                            <input
                              type="tel"
                              maxLength={11}
                              value={phone}
                              onChange={(e) => handlePhoneChange(e.target.value)}
                              placeholder="请输入员工手机号（测试: 13800138000）"
                              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)] focus:border-[var(--sw-brand)] transition-all"
                              aria-label="手机号码"
                              disabled={lockoutSeconds > 0 || loading}
                            />
                            {fieldErrors.phone && <p className="text-[11px] text-rose-500">{fieldErrors.phone}</p>}
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5 text-slate-400" /> 短信验证码
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => {
                                  setOtpCode(e.target.value);
                                  setFieldErrors((prev) => ({ ...prev, otpCode: '' }));
                                }}
                                placeholder="6位数字（演示: 123456）"
                                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)] focus:border-[var(--sw-brand)] transition-all font-mono"
                                aria-label="短信验证码"
                                disabled={lockoutSeconds > 0 || loading}
                              />
                              <button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={otpCountdown > 0 || lockoutSeconds > 0 || loading}
                                className="shrink-0 px-4 py-2.5 text-xs font-medium text-[var(--sw-brand)] bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {otpCountdown > 0 ? `${otpCountdown}s 后重发` : '获取验证码'}
                              </button>
                            </div>
                            {fieldErrors.otpCode && <p className="text-[11px] text-rose-500">{fieldErrors.otpCode}</p>}
                          </div>

                          {/* 辅助链接 */}
                          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                            <button type="button" onClick={() => setActiveTab('password')} className="hover:text-[var(--sw-brand)] transition-colors">
                              使用密码登录
                            </button>
                            <button type="button" onClick={() => setFormError('请联系您所在企业的 HR 或福利管理员重置登录身份')} className="hover:text-[var(--sw-brand)] transition-colors">
                              收不到验证码？
                            </button>
                          </div>

                          {/* 提交按钮 */}
                          <button
                            type="submit"
                            disabled={!acceptedTerms || lockoutSeconds > 0 || loading}
                            className="w-full py-3 px-4 bg-[var(--sw-brand)] hover:bg-[var(--sw-brand-dark)] text-white font-medium text-sm rounded-xl shadow-md shadow-blue-500/10 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {loading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                正在验证...
                              </>
                            ) : (
                              <>
                                验证并继续
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </form>
                      )}

                      {/* Tab 2: 登录账号/已绑定手机号 + 密码 */}
                      {activeTab === 'password' && (
                        <form onSubmit={handleStage1Submit} className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" /> 登录账号或已绑定手机号
                            </label>
                            <input
                              type="text"
                              value={identifier}
                              onChange={(e) => handleIdentifierChange(e.target.value)}
                              placeholder="输入登录账号或已绑定手机号"
                              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)] focus:border-[var(--sw-brand)] transition-all"
                              aria-label="登录账号或已绑定手机号"
                              disabled={lockoutSeconds > 0 || loading}
                            />
                            {fieldErrors.identifier && <p className="text-[11px] text-rose-500">{fieldErrors.identifier}</p>}
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5 text-slate-400" /> 密码
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                  setPassword(e.target.value);
                                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                                }}
                                placeholder="请输入密码"
                                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)] focus:border-[var(--sw-brand)] transition-all pr-10"
                                aria-label="密码"
                                disabled={lockoutSeconds > 0 || loading}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {fieldErrors.password && <p className="text-[11px] text-rose-500">{fieldErrors.password}</p>}
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setResetOpen(true);
                                setFormError('');
                              }}
                              className="hover:text-[var(--sw-brand)] transition-colors"
                            >
                              忘记密码？
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRegistrationOpen(true);
                                setFormError('');
                              }}
                              className="font-semibold text-[var(--sw-brand)] hover:underline"
                            >
                              新用户注册
                            </button>
                          </div>

                          <button
                            type="submit"
                            disabled={!acceptedTerms || lockoutSeconds > 0 || loading}
                            className="w-full py-3 px-4 bg-[var(--sw-brand)] hover:bg-[var(--sw-brand-dark)] text-white font-medium text-sm rounded-xl shadow-md shadow-blue-500/10 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {loading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                验证中...
                              </>
                            ) : (
                              <>
                                登录
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </form>
                      )}

                      {/* Tab 3: 企业微信 / 微信扫码 */}
                      {activeTab === 'work_weixin' && (
                        <div className="py-4 text-center space-y-4">
                          <div className="relative inline-block min-h-[238px] p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            {qrStatus === 'pending_scan' && (
                              <div className="space-y-2">
                                <div className="w-40 h-40 bg-white border border-slate-200 rounded-xl p-2 mx-auto flex items-center justify-center relative overflow-hidden group">
                                  <QrCode className="w-32 h-32 text-slate-800" />
                                  <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />
                                </div>
                                <p className="flex items-center justify-center gap-1 text-xs text-slate-500">
                                  请使用
                                  <button
                                    type="button"
                                    onClick={switchQrLoginChannel}
                                    className={`font-semibold transition-colors ${qrLoginChannel === 'work_weixin' ? 'text-[var(--sw-brand)] hover:text-[var(--sw-brand-dark)]' : 'text-emerald-600 hover:text-emerald-700'}`}
                                    aria-label={qrLoginChannel === 'work_weixin' ? '切换为微信扫码' : '切换为企业微信扫码'}
                                  >
                                    {qrLoginChannel === 'work_weixin' ? '企业微信' : '微信'}
                                  </button>
                                  扫描二维码
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">二维码有效期剩余 {qrCountdown}s</p>
                              </div>
                            )}

                            {qrStatus === 'scanned' && (
                              <div className="w-40 h-40 bg-emerald-50 rounded-xl mx-auto flex flex-col items-center justify-center p-4 space-y-2" role="status" aria-live="polite">
                                <UserCheck className="w-10 h-10 text-emerald-600" />
                                <p className="text-xs font-bold text-emerald-800">已扫码，等待手机确认</p>
                                <p className="text-[10px] text-emerald-700">请在{qrLoginChannel === 'work_weixin' ? '企业微信' : '微信'}中确认登录</p>
                              </div>
                            )}

                            {qrStatus === 'confirmed' && (
                              <div className="w-40 h-40 bg-blue-50 rounded-xl mx-auto flex flex-col items-center justify-center p-4 space-y-2" role="status" aria-live="polite">
                                <CheckCircle2 className="w-10 h-10 text-[var(--sw-brand)]" />
                                <p className="text-xs font-bold text-slate-900">手机确认成功</p>
                                <p className="text-[10px] text-slate-500">正在保护您的登录身份</p>
                              </div>
                            )}

                            {qrStatus === 'expired' && (
                              <div className="w-40 h-40 bg-slate-100 rounded-xl mx-auto flex flex-col items-center justify-center p-4 space-y-2">
                                <AlertCircle className="w-8 h-8 text-slate-400" />
                                <p className="text-xs font-semibold text-slate-600">二维码已失效</p>
                                <button
                                  onClick={() => {
                                    setQrStatus('pending_scan');
                                    setQrCountdown(180);
                                  }}
                                  className="px-3 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                                >
                                  <RefreshCw className="w-3 h-3" /> 刷新二维码
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 本地演示控制：真实环境将由扫码平台回调驱动 */}
                          <div className="pt-2">
                            {qrStatus === 'pending_scan' && (
                              <button onClick={() => setQrStatus('scanned')} className="text-xs font-medium text-[var(--sw-brand)] hover:underline" aria-label="演示手机扫码">
                                演示：手机已扫码
                              </button>
                            )}
                            {qrStatus === 'scanned' && (
                              <button onClick={() => setQrStatus('confirmed')} className="text-xs font-medium text-emerald-700 hover:underline" aria-label="演示手机确认登录">
                                演示：在手机端确认登录
                              </button>
                            )}
                            {qrStatus === 'confirmed' && (
                              <button
                                onClick={continueFromQrConfirmation}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sw-brand)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--sw-brand-dark)]"
                                aria-label="选择登录身份"
                              >
                                选择登录身份
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tab 4: 企业 SSO 单点登录入口 */}
                      {activeTab === 'sso' && (
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5 text-slate-400" /> 企业专属域名或 SSO 邀请码
                            </label>
                            <input
                              type="text"
                              value={ssoDomain}
                              onChange={(e) => setSsoDomain(e.target.value)}
                              placeholder="例如: tencent.hbbtzn.com 或 EMP-SSO-2026"
                              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)] focus:border-[var(--sw-brand)] transition-all font-mono"
                              aria-label="企业专属域名或邀请码"
                            />
                          </div>

                          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-slate-600 space-y-1">
                            <p className="font-semibold text-slate-800">关于企业 SSO 单点登录：</p>
                            <p className="text-[11px] text-slate-500">支持 SAML 2.0 / OIDC 标准接入。输入您的企业域名后系统将重定向至您所在企业的 IdP 统一认证 Gateway。</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!ssoDomain.trim()) {
                                setFieldErrors({ ssoDomain: '请输入企业域名或邀请码' });
                                return;
                              }
                              setFormError(`[SSO 演示] 正在重定向至企业 Authentication Gateway (${ssoDomain})...`);
                              setTimeout(() => {
                                quickFillAccount('13800138000');
                                setActiveTab('otp');
                                setFormError('');
                              }, 1500);
                            }}
                            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                          >
                            前往企业 IdP 单点登录
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 底部合规与协议勾选 */}
                    <div className="mt-auto pt-2 border-t border-slate-100">
                      <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-500">
                        <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 text-[var(--sw-brand)] rounded border-slate-300 focus:ring-[var(--sw-brand)]" />
                        <span className="leading-tight">
                          我已阅读并同意智慧翼福利商城的{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setActiveModal('terms');
                            }}
                            className="text-[var(--sw-brand)] hover:underline"
                          >
                            《用户服务协议》
                          </button>{' '}
                          与{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setActiveModal('privacy');
                            }}
                            className="text-[var(--sw-brand)] hover:underline"
                          >
                            《隐私保护政策》
                          </button>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 第二段：选择会员关系段 */}
                {stage === 2 && (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-600 flex items-start gap-2">
                      <Info className="w-4 h-4 text-[var(--sw-brand)] shrink-0 mt-0.5" />
                      <p>该账号关联了多个企业的福利计划或管理身份。请选择您本次需要进入的商城专区或运营后台：</p>
                    </div>

                    {renderMembershipsList()}
                  </div>
                )}

                {/* 第三段：Step-Up 管理身份二次验证 */}
                {stage === 3 && selectedMembership && (
                  <form onSubmit={handleStepUpSubmit} className="space-y-5">
                    <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 border border-slate-800">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                        <ShieldAlert className="w-4 h-4" />
                        即将进入高风险运营后台
                      </div>
                      <p className="text-sm font-semibold text-slate-100">{selectedMembership.enterpriseName}</p>
                      <p className="text-xs text-slate-300">
                        角色：{selectedMembership.roleName}（{selectedMembership.storeName}）
                      </p>
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                        目标域名：<span className="font-mono text-blue-300">smart.hbbtzn.com</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-[var(--sw-brand)]" />
                          TOTP 6位动态口令二次验证
                        </span>
                        <span className="text-[10px] text-slate-400">谷歌/微软身份验证器</span>
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => {
                          setTotpCode(e.target.value);
                          setFieldErrors({});
                        }}
                        placeholder="6位动态数字（测试填: 123456）"
                        className="w-full px-3.5 py-3 text-center text-lg font-mono tracking-[0.3em] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)] focus:border-[var(--sw-brand)] transition-all"
                        aria-label="TOTP 6位动态口令"
                      />
                      {fieldErrors.totpCode && <p className="text-[11px] text-rose-500">{fieldErrors.totpCode}</p>}
                      <p className="text-[11px] text-slate-400">
                        💡 测试说明：动态口令固定为 <code className="text-[var(--sw-brand)]">123456</code>，其他数字均会被拒绝。
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-4 bg-[var(--sw-brand-dark)] hover:bg-[#0D2666] text-white font-medium text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          安全签发票据并跳转...
                        </>
                      ) : (
                        <>
                          完成 Step-Up 验签并进入运营后台
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {registrationOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <form onSubmit={handleRegistrationSubmit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sw-brand)]">Member Registration</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-950">注册员工会员</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">先用账号密码建立普通员工会员。手机号、微信和企业微信以后可绑定到同一个账号；管理员与 Owner 不开放自助注册。</p>
              </div>
              <button type="button" onClick={() => setRegistrationOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="关闭注册">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium text-slate-700">
                姓名
                <input
                  value={registration.displayName}
                  onChange={(e) => updateRegistration('displayName', e.target.value)}
                  maxLength={60}
                  required
                  placeholder="请输入真实姓名"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-700">
                企业邀请码
                <input
                  value={registration.inviteCode}
                  onChange={(e) => updateRegistration('inviteCode', e.target.value.toUpperCase())}
                  maxLength={80}
                  required
                  placeholder="由企业福利管理员提供"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-700 sm:col-span-2">
                登录账号
                <input
                  value={registration.username}
                  onChange={(e) => updateRegistration('username', e.target.value.toLowerCase())}
                  minLength={4}
                  maxLength={32}
                  pattern="[A-Za-z][A-Za-z0-9._-]{3,31}"
                  required
                  autoComplete="username"
                  placeholder="4–32位，以字母开头，可含数字、点、横线和下划线"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-700">
                设置密码
                <input
                  type="password"
                  value={registration.password}
                  onChange={(e) => updateRegistration('password', e.target.value)}
                  minLength={10}
                  maxLength={128}
                  required
                  placeholder="至少10位，含字母和数字"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-700">
                确认密码
                <input
                  type="password"
                  value={registration.confirmPassword}
                  onChange={(e) => updateRegistration('confirmPassword', e.target.value)}
                  minLength={10}
                  maxLength={128}
                  required
                  placeholder="再次输入密码"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
                />
              </label>
            </div>

            {registrationNotice && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">{registrationNotice}</p>}
            {formError && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{formError}</p>}
            <label className="mt-5 flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-500">
              <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-[var(--sw-brand)]" />
              <span>我已阅读并同意《用户服务协议》和《隐私保护政策》，并确认使用本人账号注册。</span>
            </label>
            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/15 disabled:bg-slate-300"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              创建普通员工会员账号
            </button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">企业管理员不能查看你的密码。手机号与微信绑定入口已预留；未绑定手机前无法自助找回密码。</p>
          </form>
        </div>
      )}

      {resetOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <form onSubmit={submitPasswordReset} className="w-full max-w-md space-y-4 rounded-3xl border bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--sw-brand)]">Password Recovery</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">找回密码</h3>
                <p className="mt-1 text-xs text-slate-500">验证绑定手机号后重置密码，所有旧设备会立即下线。</p>
              </div>
              <button type="button" onClick={() => setResetOpen(false)} aria-label="关闭找回密码" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input value={resetForm.mobile} onChange={(e) => setResetForm({ ...resetForm, mobile: e.target.value })} placeholder="绑定手机号" className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            <div className="flex gap-2">
              <input value={resetForm.code} onChange={(e) => setResetForm({ ...resetForm, code: e.target.value })} placeholder="6位验证码" className="min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-sm" />
              <button type="button" onClick={sendResetCode} className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-[var(--sw-brand)]">
                获取验证码
              </button>
            </div>
            <input
              type="password"
              value={resetForm.password}
              onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
              placeholder="新密码（至少10位，含字母和数字）"
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
            />
            <input type="password" value={resetForm.confirm} onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })} placeholder="确认新密码" className="w-full rounded-xl border px-3.5 py-2.5 text-sm" />
            {registrationNotice && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">{registrationNotice}</p>}
            {formError && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{formError}</p>}
            <button disabled={loading || !resetForm.challengeId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-bold text-white disabled:bg-slate-300">
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}重置密码并下线全部设备
            </button>
          </form>
        </div>
      )}

      {/* 首次登录/管理员重置密码强制修改模态框 */}
      {showForcePasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">首次登录强制修改初始密码</h3>
                <p className="text-xs text-slate-500">按照企业安全风控合规要求，首次使用需重置初始密码</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">新密码（不少于8位）</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入符合复杂度的安全新密码"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-[var(--sw-brand)]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForcePasswordModal(false)} className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl">
                取消
              </button>
              <button
                onClick={async () => {
                  if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
                    setFormError('新密码至少10位，并同时包含字母和数字');
                    return;
                  }
                  setLoading(true);
                  setFormError('');
                  try {
                    await changeInitialPassword(identifier, password, newPassword);
                    setShowForcePasswordModal(false);
                    setNewPassword('');
                    setPassword('');
                    setPreAuthContext(null);
                    setFormError('初始密码已修改，请使用新密码重新登录');
                  } catch (cause) {
                    setFormError(cause instanceof Error ? cause.message : '初始密码修改失败');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 py-2 text-xs font-medium text-white bg-[var(--sw-brand)] rounded-xl disabled:bg-slate-300"
              >
                确认并提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 用户协议 / 隐私政策 模态弹窗 */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <FileText className="w-5 h-5 text-[var(--sw-brand)]" />
                {activeModal === 'terms' ? '智慧翼企业福利商城 - 用户服务协议' : '智慧翼企业福利商城 - 隐私保护政策'}
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto text-xs text-slate-600 space-y-3 pr-2 custom-scrollbar leading-relaxed">
              <p className="font-semibold text-slate-800">一、服务说明与主体定义</p>
              <p>本《统一身份与登录服务协议》适用于智慧翼企业福利商城员工端（hbbtzn.com）与运营后台（smart.hbbtzn.com）。技术服务由雍彻科技提供安全合规与鉴权支持。</p>

              <p className="font-semibold text-slate-800">二、安全与凭证红线</p>
              <p>
                1. 本系统使用短时效 Pre-Auth 上下文与一次性跨域票据 (Ticket) 进行会话传递。前端不落地存储任何永久 Token。
                <br />
                2. 涉及高风险管理权限（如资金退款、角色授权、审计查询）的操作，强制要求通过 TOTP 二次验证 (Step-Up)。
                <br />
                3. 系统对连续失败的认证尝试实施 15 分钟临时锁定，且所有认证事件均计入安全审计日志。
              </p>

              <p className="font-semibold text-slate-800">三、个人信息保护</p>
              <p>我们严格遵循最小必要原则收集您的手机号码、企业工号与角色授权信息，仅用于福利核销与安全审计用途。</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setAcceptedTerms(true);
                  setActiveModal(null);
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-[var(--sw-brand)] rounded-xl hover:bg-[var(--sw-brand-dark)]"
              >
                我已阅读并同意
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部页脚 */}
      {!isStorefrontEmbed && (
        <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
          <p>© 2026 智慧翼企业福利商城. All Rights Reserved. 技术服务方：雍彻科技</p>
        </footer>
      )}
    </div>
  );
};
