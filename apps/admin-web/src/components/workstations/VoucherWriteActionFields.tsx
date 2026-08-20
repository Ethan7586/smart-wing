import type { LiveVoucherProgram, LiveVoucherReserve } from '../../services/vouchers';
import type { VoucherWriteAction } from './voucherWriteAction';

export interface VoucherWriteFieldValues {
  programId: string;
  reserveId: string;
  quantity: string;
  decision: 'approved' | 'rejected';
  statusOperation: 'activate' | 'disable' | 'extend' | 'void';
  extensionDays: string;
  voucherCode: string;
  amountYuan: string;
  merchantReference: string;
  reconciliationReference: string;
  reconciliationNote: string;
}

export const INITIAL_VOUCHER_WRITE_FIELDS: VoucherWriteFieldValues = {
  programId: '',
  reserveId: '',
  quantity: '',
  decision: 'approved',
  statusOperation: 'activate',
  extensionDays: '30',
  voucherCode: '',
  amountYuan: '',
  merchantReference: '',
  reconciliationReference: '',
  reconciliationNote: '',
};

interface VoucherWriteActionFieldsProps {
  action: VoucherWriteAction;
  programs: LiveVoucherProgram[];
  approvedReserves: LiveVoucherReserve[];
  selectedProgramId: string;
  selectedReserveId: string;
  values: VoucherWriteFieldValues;
  onChange: <K extends keyof VoucherWriteFieldValues>(key: K, value: VoucherWriteFieldValues[K]) => void;
}

/** The per-action input fields; the dialog itself owns submission and step-up. */
export function VoucherWriteActionFields({ action, programs, approvedReserves, selectedProgramId, selectedReserveId, values, onChange }: VoucherWriteActionFieldsProps) {
  return (
    <>
      {action.kind === 'reserve' && (
        <>
          <label className="block text-xs font-semibold text-slate-600">
            卡券产品
            <select
              value={selectedProgramId}
              onChange={(event) => onChange('programId', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
            >
              {programs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}（¥{(item.denominationCents / 100).toFixed(2)}）
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            申请数量
            <input
              value={values.quantity}
              onChange={(event) => onChange('quantity', event.target.value)}
              inputMode="numeric"
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
              placeholder="请输入 1–1,000,000 的整数"
            />
          </label>
        </>
      )}

      {action.kind === 'approval' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="text-slate-500">申请单：</span>
            <strong className="font-mono text-slate-800">{action.reserve.requestNo}</strong>
            <span className="ml-3 text-slate-500">产品：</span>
            <strong className="text-slate-800">{action.reserve.programName}</strong>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            审批结果
            <select
              value={values.decision}
              onChange={(event) => onChange('decision', event.target.value as 'approved' | 'rejected')}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
            >
              <option value="approved">同意</option>
              <option value="rejected">拒绝</option>
            </select>
          </label>
        </>
      )}

      {action.kind === 'issue' && (
        <>
          <label className="block text-xs font-semibold text-slate-600">
            已批准备券申请
            <select
              value={selectedReserveId}
              onChange={(event) => onChange('reserveId', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
            >
              {approvedReserves.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.requestNo} · {item.programName} · {item.requestedQuantity.toLocaleString('zh-CN')} 张
                </option>
              ))}
            </select>
          </label>
          <p className="rounded-xl border border-blue-100 bg-[var(--sw-brand-light)] p-3 text-[11px] leading-relaxed text-[var(--sw-brand-dark)]">首版只发行电子储值券：系统生成不可预测券码，不占用实体卡号。</p>
        </>
      )}

      {action.kind === 'status' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="text-slate-500">券码：</span>
            <strong className="font-mono text-slate-800">{action.voucher.voucherCode}</strong>
            <span className="ml-3 text-slate-500">当前版本：</span>
            <strong className="font-mono text-slate-800">{action.voucher.version}</strong>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            操作
            <select
              value={values.statusOperation}
              onChange={(event) => onChange('statusOperation', event.target.value as 'activate' | 'disable' | 'extend' | 'void')}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
            >
              <option value="activate">激活</option>
              <option value="disable">禁用</option>
              <option value="extend">延期</option>
              <option value="void">作废</option>
            </select>
          </label>
          {values.statusOperation === 'extend' && (
            <label className="block text-xs font-semibold text-slate-600">
              延期天数
              <input
                value={values.extensionDays}
                onChange={(event) => onChange('extensionDays', event.target.value)}
                inputMode="numeric"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
              />
            </label>
          )}
          {values.statusOperation === 'void' && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">作废不会自动退回企业余额。系统将冻结该券的未使用余额，生成一条仅财务人员可处理的人工对账记录。</p>
          )}
        </>
      )}

      {action.kind === 'redeem' && (
        <>
          <label className="block text-xs font-semibold text-slate-600">
            券码
            <input
              value={values.voucherCode}
              onChange={(event) => onChange('voucherCode', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[var(--sw-brand)]"
              placeholder="扫描或输入券码"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            核销金额（元）
            <input
              value={values.amountYuan}
              onChange={(event) => onChange('amountYuan', event.target.value)}
              inputMode="decimal"
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[var(--sw-brand)]"
              placeholder="例如 100.00"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            门店交易参考号
            <input
              value={values.merchantReference}
              onChange={(event) => onChange('merchantReference', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[var(--sw-brand)]"
              placeholder="POS 交易流水号"
            />
          </label>
        </>
      )}

      {action.kind === 'reverse' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <span className="text-slate-500">核销流水：</span>
          <strong className="font-mono text-slate-800">{action.redemption.redemptionNo}</strong>
          <span className="ml-3 text-slate-500">券码：</span>
          <strong className="font-mono text-slate-800">{action.redemption.voucherCode}</strong>
        </div>
      )}

      {action.kind === 'reconcile' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="text-slate-500">冻结券码：</span>
            <strong className="font-mono text-slate-800">{action.voidHold.voucherCode}</strong>
            <span className="ml-3 text-slate-500">冻结金额：</span>
            <strong className="font-mono text-slate-800">¥{(action.voidHold.amountCents / 100).toFixed(2)}</strong>
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">此操作只记录人工对账完成，不会自动把冻结余额退回企业，也不会恢复该卡券。</p>
          <label className="block text-xs font-semibold text-slate-600">
            对账参考号
            <input
              value={values.reconciliationReference}
              onChange={(event) => onChange('reconciliationReference', event.target.value)}
              maxLength={160}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs outline-none focus:border-[var(--sw-brand)]"
              placeholder="财务凭证或工单号"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            对账说明
            <textarea
              value={values.reconciliationNote}
              onChange={(event) => onChange('reconciliationNote', event.target.value)}
              maxLength={500}
              className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[var(--sw-brand)]"
              placeholder="说明处置结论与依据"
            />
          </label>
        </>
      )}
    </>
  );
}
