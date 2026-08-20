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
import { VoucherWriteActionFields, INITIAL_VOUCHER_WRITE_FIELDS, type VoucherWriteFieldValues } from './VoucherWriteActionFields';
import { operationErrorMessage, titleFor, yuanToCents, type VoucherWriteAction } from './voucherWriteAction';

interface VoucherWriteActionDialogProps {
  action: VoucherWriteAction | null;
  programs: LiveVoucherProgram[];
  reserves: LiveVoucherReserve[];
  onClose: () => void;
  onCompleted: () => void;
}

/**
 * The dialog is deliberately unavailable unless its parent has both the
 * matching server-derived permission and an explicit environment write flag.
 * Every high-risk submission performs server-session-bound TOTP step-up.
 */
export function VoucherWriteActionDialog({ action, programs, reserves, onClose, onCompleted }: VoucherWriteActionDialogProps) {
  const [fields, setFields] = useState<VoucherWriteFieldValues>(INITIAL_VOUCHER_WRITE_FIELDS);
  const updateField = <K extends keyof VoucherWriteFieldValues>(key: K, value: VoucherWriteFieldValues[K]) => setFields((current) => ({ ...current, [key]: value }));
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!action) return null;
  const requiresStepUp = action.kind !== 'reserve';
  const approvedReserves = reserves.filter((item) => item.status === 'approved');
  const selectedProgramId = fields.programId || programs[0]?.id || '';
  const selectedReserveId = fields.reserveId || approvedReserves[0]?.id || '';

  const submitOperation = async () => {
    switch (action.kind) {
      case 'reserve':
        await createVoucherReserve({ voucherProgramId: selectedProgramId, quantity: Number(fields.quantity), reason });
        return;
      case 'approval':
        await decideVoucherReserve(action.reserve.id, { decision: fields.decision, reason, evidence });
        return;
      case 'issue':
        await issueVoucherBatch(selectedReserveId);
        return;
      case 'status':
        await changeVoucherStatus(action.voucher.id, {
          operation: fields.statusOperation,
          expectedVersion: action.voucher.version,
          extensionDays: fields.statusOperation === 'extend' ? Number(fields.extensionDays) : undefined,
          reason,
          evidence,
        });
        return;
      case 'redeem':
        await redeemVoucher({ voucherCode: fields.voucherCode, amountCents: yuanToCents(fields.amountYuan), merchantReference: fields.merchantReference });
        return;
      case 'reverse':
        await reverseVoucherRedemption(action.redemption.id, reason);
        return;
      case 'reconcile':
        await reconcileVoucherVoidBalanceHold(action.voidHold.id, { reconciliationReference: fields.reconciliationReference, reconciliationNote: fields.reconciliationNote });
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

  const canSubmit = action.kind === 'reserve' ? programs.length > 0 : action.kind === 'issue' ? approvedReserves.length > 0 : true;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="voucher-write-title">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h2 id="voucher-write-title" className="text-base font-bold text-slate-900">
              {titleFor(action)}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">提交前由服务端重新校验权限、数据范围、幂等键和交易状态。</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <VoucherWriteActionFields action={action} programs={programs} approvedReserves={approvedReserves} selectedProgramId={selectedProgramId} selectedReserveId={selectedReserveId} values={fields} onChange={updateField} />

          {(action.kind === 'reserve' || action.kind === 'approval' || action.kind === 'status' || action.kind === 'reverse') && (
            <>
              <label className="block text-xs font-semibold text-slate-600">
                操作原因
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[var(--sw-brand)]"
                  placeholder="请填写可审计的业务原因"
                />
              </label>
              {(action.kind === 'approval' || action.kind === 'status') && (
                <label className="block text-xs font-semibold text-slate-600">
                  证据或附件说明（可选）
                  <input
                    value={evidence}
                    onChange={(event) => setEvidence(event.target.value)}
                    maxLength={2000}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
                    placeholder="例如审批单号、工单号"
                  />
                </label>
              )}
            </>
          )}

          {requiresStepUp && (
            <div className="rounded-xl border border-blue-100 bg-[var(--sw-brand-light)] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--sw-brand-dark)]">
                <ShieldCheck className="h-4 w-4" />
                二次认证
              </div>
              {challengeId ? (
                <label className="mt-2 block text-xs text-slate-600">
                  6 位动态口令
                  <input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="mt-1.5 h-10 w-full rounded-xl border border-blue-200 bg-white px-3 font-mono text-sm tracking-[0.25em] outline-none focus:border-[var(--sw-brand)]"
                  />
                </label>
              ) : (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">点击“发起二次认证”后，服务端会创建一个绑定当前安全会话、五分钟有效的动态口令挑战。</p>
              )}
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600">
            取消
          </button>
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !canSubmit} className="rounded-xl bg-[var(--sw-brand)] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? '处理中…' : requiresStepUp && !challengeId ? '发起二次认证' : '确认并提交'}
          </button>
        </div>
      </div>
    </div>
  );
}
