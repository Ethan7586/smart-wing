import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, X } from 'lucide-react';
import {
  changeVoucherStatus,
  createVoucherReserve,
  decideVoucherReserve,
  issueVoucherBatch,
  redeemVoucher,
  reconcileVoucherVoidBalanceHold,
  reverseVoucherRedemption,
  startVoucherStepUp,
  verifyVoucherStepUp,
  VoucherOperationError,
} from '../../services/voucherOperations';
import type { LiveVoucher, LiveVoucherProgram, LiveVoucherRedemption, LiveVoucherReserve, LiveVoucherVoidBalanceHold } from '../../services/vouchers';

export type VoucherWriteAction =
  | { kind: 'reserve' }
  | { kind: 'approval'; reserve: LiveVoucherReserve }
  | { kind: 'issue' }
  | { kind: 'status'; voucher: LiveVoucher }
  | { kind: 'redeem' }
  | { kind: 'reverse'; redemption: LiveVoucherRedemption }
  | { kind: 'reconcile'; voidHold: LiveVoucherVoidBalanceHold };

interface VoucherWriteActionDialogProps {
  action: VoucherWriteAction | null;
  programs: LiveVoucherProgram[];
  reserves: LiveVoucherReserve[];
  onClose: () => void;
  onCompleted: () => void;
}

function yuanToCents(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  const [yuan, decimal = ''] = normalized.split('.');
  const cents = Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 1) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  return cents;
}

function operationErrorMessage(error: unknown): string {
  if (error instanceof VoucherOperationError) return error.message;
  return error instanceof Error && error.message === 'VOUCHER_CLIENT_INPUT_INVALID' ? '请检查必填信息、金额和操作参数。' : '卡券操作未完成，请稍后重试。';
}

function titleFor(action: VoucherWriteAction): string {
  switch (action.kind) {
    case 'reserve': return '创建备券申请';
    case 'approval': return '处理备券审批';
    case 'issue': return '发行电子券批次';
    case 'status': return '变更单券状态';
    case 'redeem': return '门店核销券码';
    case 'reverse': return '冲正核销流水';
    case 'reconcile': return '处理作废余额对账';
  }
}

/**
 * The dialog is deliberately unavailable unless its parent has both the
 * matching server-derived permission and an explicit environment write flag.
 * Every high-risk submission performs server-session-bound TOTP step-up.
 */
export function VoucherWriteActionDialog({ action, programs, reserves, onClose, onCompleted }: VoucherWriteActionDialogProps) {
  const [programId, setProgramId] = useState('');
  const [reserveId, setReserveId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [statusOperation, setStatusOperation] = useState<'activate' | 'disable' | 'extend' | 'void'>('activate');
  const [extensionDays, setExtensionDays] = useState('30');
  const [voucherCode, setVoucherCode] = useState('');
  const [amountYuan, setAmountYuan] = useState('');
  const [merchantReference, setMerchantReference] = useState('');
  const [reconciliationReference, setReconciliationReference] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!action) return null;
  const requiresStepUp = action.kind !== 'reserve';
  const approvedReserves = reserves.filter((item) => item.status === 'approved');
  const selectedProgramId = programId || programs[0]?.id || '';
  const selectedReserveId = reserveId || approvedReserves[0]?.id || '';

  const submitOperation = async () => {
    switch (action.kind) {
      case 'reserve':
        await createVoucherReserve({ voucherProgramId: selectedProgramId, quantity: Number(quantity), reason });
        return;
      case 'approval':
        await decideVoucherReserve(action.reserve.id, { decision, reason, evidence });
        return;
      case 'issue':
        await issueVoucherBatch(selectedReserveId);
        return;
      case 'status':
        await changeVoucherStatus(action.voucher.id, {
          operation: statusOperation,
          expectedVersion: action.voucher.version,
          extensionDays: statusOperation === 'extend' ? Number(extensionDays) : undefined,
          reason,
          evidence,
        });
        return;
      case 'redeem':
        await redeemVoucher({ voucherCode, amountCents: yuanToCents(amountYuan), merchantReference });
        return;
      case 'reverse':
        await reverseVoucherRedemption(action.redemption.id, reason);
        return;
      case 'reconcile':
        await reconcileVoucherVoidBalanceHold(action.voidHold.id, { reconciliationReference, reconciliationNote });
        return;
    }
  };

  const handleSubmit = async () => {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (requiresStepUp && !challengeId) {
        const challenge = await startVoucherStepUp();
        setChallengeId(challenge.challengeId);
        setNotice(`已发起动态口令认证，请在 ${new Date(challenge.expiresAt).toLocaleTimeString('zh-CN', { hour12: false })} 前输入 6 位验证码。`);
        return;
      }
      if (requiresStepUp && challengeId) await verifyVoucherStepUp(challengeId, verificationCode);
      await submitOperation();
      onCompleted();
      onClose();
    } catch (submissionError) {
      setError(operationErrorMessage(submissionError));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = action.kind === 'reserve'
    ? programs.length > 0
    : action.kind === 'issue'
      ? approvedReserves.length > 0
      : true;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="voucher-write-title">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div><h2 id="voucher-write-title" className="text-base font-bold text-slate-900">{titleFor(action)}</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">提交前由服务端重新校验权限、数据范围、幂等键和交易状态。</p></div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="关闭"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          {action.kind === 'reserve' && <>
            <label className="block text-xs font-semibold text-slate-600">卡券产品<select value={selectedProgramId} onChange={(event) => setProgramId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#1F5EFF]">{programs.map((item) => <option key={item.id} value={item.id}>{item.name}（¥{(item.denominationCents / 100).toFixed(2)}）</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">申请数量<input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[#1F5EFF]" placeholder="请输入 1–1,000,000 的整数" /></label>
          </>}

          {action.kind === 'approval' && <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><span className="text-slate-500">申请单：</span><strong className="font-mono text-slate-800">{action.reserve.requestNo}</strong><span className="ml-3 text-slate-500">产品：</span><strong className="text-slate-800">{action.reserve.programName}</strong></div>
            <label className="block text-xs font-semibold text-slate-600">审批结果<select value={decision} onChange={(event) => setDecision(event.target.value as 'approved' | 'rejected')} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#1F5EFF]"><option value="approved">同意</option><option value="rejected">拒绝</option></select></label>
          </>}

          {action.kind === 'issue' && <><label className="block text-xs font-semibold text-slate-600">已批准备券申请<select value={selectedReserveId} onChange={(event) => setReserveId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#1F5EFF]">{approvedReserves.map((item) => <option key={item.id} value={item.id}>{item.requestNo} · {item.programName} · {item.requestedQuantity.toLocaleString('zh-CN')} 张</option>)}</select></label><p className="rounded-xl border border-blue-100 bg-[#EAF1FF] p-3 text-[11px] leading-relaxed text-[#143A8F]">首版只发行电子储值券：系统生成不可预测券码，不占用实体卡号。</p></>}

          {action.kind === 'status' && <><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><span className="text-slate-500">券码：</span><strong className="font-mono text-slate-800">{action.voucher.voucherCode}</strong><span className="ml-3 text-slate-500">当前版本：</span><strong className="font-mono text-slate-800">{action.voucher.version}</strong></div><label className="block text-xs font-semibold text-slate-600">操作<select value={statusOperation} onChange={(event) => setStatusOperation(event.target.value as 'activate' | 'disable' | 'extend' | 'void')} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#1F5EFF]"><option value="activate">激活</option><option value="disable">禁用</option><option value="extend">延期</option><option value="void">作废</option></select></label>{statusOperation === 'extend' && <label className="block text-xs font-semibold text-slate-600">延期天数<input value={extensionDays} onChange={(event) => setExtensionDays(event.target.value)} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[#1F5EFF]" /></label>}{statusOperation === 'void' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">作废不会自动退回企业余额。系统将冻结该券的未使用余额，生成一条仅财务人员可处理的人工对账记录。</p>}</>}

          {action.kind === 'redeem' && <><label className="block text-xs font-semibold text-slate-600">券码<input value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[#1F5EFF]" placeholder="扫描或输入券码" /></label><label className="block text-xs font-semibold text-slate-600">核销金额（元）<input value={amountYuan} onChange={(event) => setAmountYuan(event.target.value)} inputMode="decimal" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[#1F5EFF]" placeholder="例如 100.00" /></label><label className="block text-xs font-semibold text-slate-600">门店交易参考号<input value={merchantReference} onChange={(event) => setMerchantReference(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[#1F5EFF]" placeholder="POS 交易流水号" /></label></>}

          {action.kind === 'reverse' && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><span className="text-slate-500">核销流水：</span><strong className="font-mono text-slate-800">{action.redemption.redemptionNo}</strong><span className="ml-3 text-slate-500">券码：</span><strong className="font-mono text-slate-800">{action.redemption.voucherCode}</strong></div>}

          {action.kind === 'reconcile' && <><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><span className="text-slate-500">冻结券码：</span><strong className="font-mono text-slate-800">{action.voidHold.voucherCode}</strong><span className="ml-3 text-slate-500">冻结金额：</span><strong className="font-mono text-slate-800">¥{(action.voidHold.amountCents / 100).toFixed(2)}</strong></div><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">此操作只记录人工对账完成，不会自动把冻结余额退回企业，也不会恢复该卡券。</p><label className="block text-xs font-semibold text-slate-600">对账参考号<input value={reconciliationReference} onChange={(event) => setReconciliationReference(event.target.value)} maxLength={160} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[#1F5EFF]" placeholder="财务凭证或工单号" /></label><label className="block text-xs font-semibold text-slate-600">对账说明<textarea value={reconciliationNote} onChange={(event) => setReconciliationNote(event.target.value)} maxLength={500} className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[#1F5EFF]" placeholder="说明处置结论与依据" /></label></>}

          {(action.kind === 'reserve' || action.kind === 'approval' || action.kind === 'status' || action.kind === 'reverse') && <><label className="block text-xs font-semibold text-slate-600">操作原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[#1F5EFF]" placeholder="请填写可审计的业务原因" /></label>{(action.kind === 'approval' || action.kind === 'status') && <label className="block text-xs font-semibold text-slate-600">证据或附件说明（可选）<input value={evidence} onChange={(event) => setEvidence(event.target.value)} maxLength={2000} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[#1F5EFF]" placeholder="例如审批单号、工单号" /></label>}</>}

          {requiresStepUp && <div className="rounded-xl border border-blue-100 bg-[#EAF1FF] p-3"><div className="flex items-center gap-2 text-xs font-semibold text-[#143A8F]"><ShieldCheck className="h-4 w-4" />二次认证</div>{challengeId ? <label className="mt-2 block text-xs text-slate-600">6 位动态口令<input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-1.5 h-10 w-full rounded-xl border border-blue-200 bg-white px-3 font-mono text-sm tracking-[0.25em] outline-none focus:border-[#1F5EFF]" /></label> : <p className="mt-1 text-[11px] leading-relaxed text-slate-600">点击“发起二次认证”后，服务端会创建一个绑定当前安全会话、五分钟有效的动态口令挑战。</p>}</div>}
          {notice && <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4"><button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600">取消</button><button type="button" onClick={() => void handleSubmit()} disabled={submitting || !canSubmit} className="rounded-xl bg-[#1F5EFF] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? '处理中…' : requiresStepUp && !challengeId ? '发起二次认证' : '确认并提交'}</button></div>
      </div>
    </div>
  );
}
