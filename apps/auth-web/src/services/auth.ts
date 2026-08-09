/**
 * 智慧翼企业福利商城 - 认证与权限 Mock 服务 (auth.ts)
 * 职责：模拟统一登录认证段、会员关系查询、Step-Up 二次验证、跨域票据交换及安全审计
 * 技术服务方：雍彻科技
 */

import { Membership, PreAuthContext, StepUpVerifyResult, LockoutState } from '../types';

// 内存中维护的登录失败记录（模拟服务端 Redis / DB 锁定策略）
interface FailureRecord {
  attempts: number;
  lockedUntil: number; // 时间戳
}

const failureMap: Record<string, FailureRecord> = {};
const stepUpFailureMap: Record<string, FailureRecord> = {};

// 模拟审计日志
const auditLogs: Array<{ timestamp: string; identifier: string; reason: string }> = [];

// 模拟不同场景的预设会员关系数据集
const MOCK_MEMBERSHIPS_MAP: Record<string, Membership[]> = {
  // 13800138000: 综合多身份账号（混合员工与管理身份）
  '13800138000': [
    {
      id: 'mem_emp_001',
      target: 'storefront',
      status: 'active',
      enterpriseName: '腾讯科技（深圳）有限公司',
      storeName: '智慧翼·腾讯员工福利专区',
      roleName: '正式员工',
      dataScope: '个人福利包',
      accountTypeLabel: '福利账户',
    },
    {
      id: 'mem_emp_002',
      target: 'storefront',
      status: 'active',
      enterpriseName: '腾讯科技（深圳）有限公司',
      storeName: '智慧翼·园区美食餐厅',
      roleName: '正式员工',
      dataScope: '每日餐补',
      accountTypeLabel: '餐卡',
    },
    {
      id: 'mem_adm_001',
      target: 'admin',
      status: 'active',
      enterpriseName: '腾讯科技（深圳）有限公司',
      storeName: '智慧翼·企业福利运营后台',
      roleName: '企业福利超级管理员',
      dataScope: '全公司（12,500人）',
      subjectScope: '企业',
      keyPermissions: ['order.refund', 'role.grant', 'audit.read'],
      authorizedBy: '雍彻科技安全审计部 (admin_01)',
      expireAt: '2027-12-31',
      requiresStepUp: true,
    },
    {
      id: 'mem_adm_002',
      target: 'admin',
      status: 'active',
      enterpriseName: '雍彻科技（上海）有限公司',
      storeName: '智慧翼·特约供应商中心',
      roleName: '商品运营专员',
      dataScope: '华东大区专区',
      subjectScope: '供应商',
      keyPermissions: ['goods.publish', 'order.view'],
      authorizedBy: '张主管 (mgr_888)',
      expireAt: '2026-12-31',
      requiresStepUp: false,
    },
  ],

  // 13900139000: 单一高阶管理账号（1条记录且需StepUp，测试自动进入第3段）
  '13900139000': [
    {
      id: 'mem_adm_sys',
      target: 'admin',
      status: 'active',
      enterpriseName: '智慧翼（总部）运营中心',
      storeName: '智慧翼全域统一管理后台',
      roleName: '全域系统风控合规总监',
      dataScope: '全平台所有租户与企业',
      subjectScope: '租户',
      keyPermissions: ['order.refund', 'role.grant', 'audit.read', 'system.config'],
      authorizedBy: '雍彻科技首席安全官',
      expireAt: '2028-06-30',
      requiresStepUp: true,
    },
  ],

  // 13700137000: 单一员工账号（1条记录，测试自动跳过第2段直接完成）
  '13700137000': [
    {
      id: 'mem_emp_single',
      target: 'storefront',
      status: 'active',
      enterpriseName: '阿里巴巴（中国）有限公司',
      storeName: '智慧翼·阿里专享福利商城',
      roleName: '资深专家',
      dataScope: '个人专享额度',
      accountTypeLabel: '福利账户',
    },
  ],

  // 13600136000: 多种特殊状态账号（包含 invited, suspended, offboarded, expired）
  '13600136000': [
    {
      id: 'mem_status_invited',
      target: 'storefront',
      status: 'invited',
      enterpriseName: '美团点评集团',
      storeName: '智慧翼·美团员工特惠商城',
      roleName: '待入职员工',
      dataScope: '新员工礼包',
      accountTypeLabel: '福利账户',
    },
    {
      id: 'mem_status_suspended',
      target: 'storefront',
      status: 'suspended',
      enterpriseName: '字节跳动科技有限公司',
      storeName: '智慧翼·字节福利专区',
      roleName: '正式员工',
      dataScope: '暂停发放',
      accountTypeLabel: '福利账户',
    },
    {
      id: 'mem_status_offboarded',
      target: 'storefront',
      status: 'offboarded',
      enterpriseName: '百度在线网络技术公司',
      storeName: '智慧翼·百度福利商城',
      roleName: '离职员工',
      dataScope: '已归档',
      accountTypeLabel: '福利账户',
    },
    {
      id: 'mem_status_expired',
      target: 'storefront',
      status: 'expired',
      enterpriseName: '华为技术有限公司',
      storeName: '智慧翼·华为2025年度节日商城',
      roleName: '合约用户',
      dataScope: '2025周期已截止',
      accountTypeLabel: '福利账户',
    },
  ],

  // 13500135000: 无任何有效企业福利计划
  '13500135000': [],
};

/**
 * 获取账号当前锁定状态
 */
export function getLockoutState(identifier: string): LockoutState {
  const record = failureMap[identifier];
  if (!record) {
    return { isLocked: false, remainingSeconds: 0, failedAttempts: 0 };
  }

  const now = Date.now();
  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      remainingSeconds,
      failedAttempts: record.attempts,
    };
  }

  // 锁定时间已过，重置状态
  if (record.attempts >= 5 && record.lockedUntil <= now) {
    delete failureMap[identifier];
  }

  return {
    isLocked: false,
    remainingSeconds: 0,
    failedAttempts: record?.attempts || 0,
  };
}

/**
 * 上报登录失败记录（安全审计要求）
 */
export async function reportLoginFailure(identifier: string, reason: string): Promise<void> {
  const timestamp = new Date().toISOString();
  auditLogs.push({ timestamp, identifier, reason });
  console.warn(`[SECURITY AUDIT LOG] Login failure for "${identifier}": ${reason} at ${timestamp}`);

  // 增加失败计数
  if (!failureMap[identifier]) {
    failureMap[identifier] = { attempts: 1, lockedUntil: 0 };
  } else {
    failureMap[identifier].attempts += 1;
  }

  // 连续失败5次，锁定15分钟 (15 * 60 * 1000 ms)
  if (failureMap[identifier].attempts >= 5) {
    failureMap[identifier].lockedUntil = Date.now() + 15 * 60 * 1000;
    console.error(`[SECURITY ALERT] Identifier "${identifier}" locked for 15 minutes due to 5 consecutive failures.`);
  }
}

/**
 * 1. 发送短信验证码
 */
export async function requestOtp(phone: string): Promise<{ success: boolean; message: string }> {
  // 校验手机号格式
  const cleanPhone = phone.trim();
  if (!/^1[3-9]\d{9}$/.test(cleanPhone)) {
    throw new Error('请输入正确的11位手机号码');
  }

  const lockout = getLockoutState(cleanPhone);
  if (lockout.isLocked) {
    throw new Error(`账号已锁定，请在 ${Math.ceil(lockout.remainingSeconds / 60)} 分钟后重试`);
  }

  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 600));

  return {
    success: true,
    message: '验证码已发送，测试环境下默认验证码为：123456',
  };
}

/**
 * 2. 手机号 + 短信验证码登录
 */
export async function loginWithOtp(phone: string, code: string): Promise<PreAuthContext> {
  const cleanPhone = phone.trim();
  const cleanCode = code.trim();

  // 检查锁定
  const lockout = getLockoutState(cleanPhone);
  if (lockout.isLocked) {
    throw new Error(`账号连续失败过多，已被锁定。剩余解封时间：${lockout.remainingSeconds} 秒`);
  }

  await new Promise((resolve) => setTimeout(resolve, 800));

  // 默认演示验证码为 123456
  if (cleanCode !== '123456') {
    await reportLoginFailure(cleanPhone, '短信验证码不正确或已失效');
    throw new Error('账号或验证码不正确'); // 安全红线：统一提示，不泄漏细节
  }

  // 登录成功，清除失败记录
  delete failureMap[cleanPhone];

  // 获取对应的会员列表（如未找到，默认给13800138000的数据，或空数据）
  const memberships = MOCK_MEMBERSHIPS_MAP[cleanPhone] ?? MOCK_MEMBERSHIPS_MAP['13800138000'];

  return {
    preAuthToken: `PAT_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    phone: cleanPhone,
    loginMethod: 'otp',
    requiresPasswordReset: cleanPhone === '13400134000',
    memberships: JSON.parse(JSON.stringify(memberships)),
  };
}

/**
 * 3. 工号/邮箱 + 密码登录
 */
export async function loginWithPassword(identifier: string, password: string): Promise<PreAuthContext> {
  const cleanId = identifier.trim();
  const cleanPw = password.trim();

  if (!cleanId || !cleanPw) {
    throw new Error('请输入账号与密码');
  }

  // 检查锁定
  const lockout = getLockoutState(cleanId);
  if (lockout.isLocked) {
    throw new Error(`账号已被锁定，请在 ${Math.ceil(lockout.remainingSeconds / 60)} 分钟后再试`);
  }

  await new Promise((resolve) => setTimeout(resolve, 800));

  // 演示账号密码校验：密码统一为 password123 (或根据规则)
  // 如果输入的是测试账号或合法手机号
  const isMatch = cleanPw === 'password123' || cleanPw === 'admin123';

  if (!isMatch) {
    await reportLoginFailure(cleanId, '密码验证失败');
    // 安全红线：统一文案 "账号或密码不正确"
    throw new Error('账号或密码不正确');
  }

  delete failureMap[cleanId];

  const memberships = MOCK_MEMBERSHIPS_MAP[cleanId] ?? MOCK_MEMBERSHIPS_MAP['13800138000'];

  return {
    preAuthToken: `PAT_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    identifier: cleanId,
    loginMethod: 'password',
    requiresPasswordReset: cleanId === '13400134000' || cleanId === 'force_user',
    memberships: JSON.parse(JSON.stringify(memberships)),
  };
}

/**
 * 4. 接受邀请 API
 */
export async function acceptInvitation(preAuthToken: string, membershipId: string): Promise<Membership[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  // 模拟将 invited 改为 active
  return [];
}

/**
 * 5. Step-Up 动态二次验证 (TOTP 6位)
 */
export async function verifyStepUp(preAuthToken: string, membershipId: string, totpCode: string): Promise<StepUpVerifyResult> {
  const cleanCode = totpCode.trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('请输入6位数字动态口令');
  }

  await new Promise((resolve) => setTimeout(resolve, 700));

  // 测试用 TOTP 代码：任意 6 位数字，如 654321 或 123456；如输 000000 则测试失败
  if (cleanCode === '000000') {
    // 独立计数与独立审计
    const auditKey = `stepup_${preAuthToken}`;
    if (!stepUpFailureMap[auditKey]) {
      stepUpFailureMap[auditKey] = { attempts: 1, lockedUntil: 0 };
    } else {
      stepUpFailureMap[auditKey].attempts += 1;
    }
    await reportLoginFailure(preAuthToken, `Step-Up 二次验证失败 (${membershipId})`);
    // 安全红线：不退回也不透露身份存在性
    throw new Error('二次验证失败：动态口令错误或已过期');
  }

  // 产生一次性高权限票据 Ticket
  const ticket = `TICKET_SMART_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  return {
    ticket,
    targetDomain: 'smart.hbbtzn.com',
    redirectUrl: `https://smart.hbbtzn.com/auth/callback?ticket=${ticket}`,
    expiresInSeconds: 60,
  };
}

/**
 * 6. 一次性票据兑换（运营后台 smart.hbbtzn.com 回调处理）
 */
export async function exchangeTicket(ticket: string): Promise<{ success: boolean; sessionInfo: any }> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (!ticket || !ticket.startsWith('TICKET_SMART_')) {
    throw new Error('票据无效或已过期，请重新进行统一登录');
  }

  return {
    success: true,
    sessionInfo: {
      userId: 'usr_admin_001',
      role: 'EnterpriseAdmin',
      domain: 'smart.hbbtzn.com',
      issuedAt: new Date().toISOString(),
    },
  };
}

/**
 * 7. 修改密码预留接口
 */
export async function updatePassword(preAuthToken: string, oldPw: string, newPw: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (newPw.length < 8) {
    throw new Error('新密码长度不能少于8位');
  }
  return true;
}
