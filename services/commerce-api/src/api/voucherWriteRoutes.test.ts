import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@smart-wing/api-contract';
import { handleChangeAdminVoucherStatus, handleCreateAdminVoucherReserve, handleIssueAdminVoucherBatch, handleReconcileAdminVoucherVoidHold, handleRedeemAdminVoucher, handleReverseAdminVoucherRedemption } from './voucherWriteRoutes';
import { context, contextWithPermissions } from './voucherTestSupport';

const { callRpcMock, sha256Mock } = vi.hoisted(() => ({ callRpcMock: vi.fn(), sha256Mock: vi.fn() }));

vi.mock('./supabase', () => ({ callRpc: callRpcMock }));
vi.mock('./crypto', () => ({ sha256: sha256Mock }));

describe('admin voucher write routes', () => {
  it('requires an idempotency key before creating a reserve request', async () => {
    callRpcMock.mockReset();
    const response = await handleCreateAdminVoucherReserve(
      new Request('https://smart.example/api/v1/admin/voucher-reserves', {
        method: 'POST',
        body: JSON.stringify({ voucherProgramId: 'program-a', quantity: 10, reason: '企业福利发放' }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherReserveCreate]),
      'reserve-idempotency-required'
    );
    expect(response.status).toBe(400);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('does not load or change voucher state until a high-risk operator completes fresh step-up authentication', async () => {
    callRpcMock.mockReset();
    const response = await handleChangeAdminVoucherStatus(
      new Request('https://smart.example/api/v1/admin/vouchers/voucher-a/status', {
        method: 'POST',
        headers: { 'idempotency-key': 'status-no-step-up' },
        body: JSON.stringify({ operation: 'disable', expectedVersion: 2, reason: '风险处置' }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherStatusManage]),
      'voucher-a',
      'status-step-up-required'
    );
    expect(response.status).toBe(403);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('requires a store transaction reference before resolving a voucher for redemption', async () => {
    callRpcMock.mockReset();
    const response = await handleRedeemAdminVoucher(
      new Request('https://smart.example/api/v1/admin/voucher-redemptions', {
        method: 'POST',
        headers: { 'idempotency-key': 'redeem-without-reference' },
        body: JSON.stringify({ voucherCode: 'SW-0001', amountCents: 5000 }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherRedeem], new Date().toISOString()),
      'redeem-reference-required'
    );
    expect(response.status).toBe(422);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('issues an electronic voucher batch without requiring a physical card pool', async () => {
    callRpcMock.mockReset();
    sha256Mock.mockReset();
    sha256Mock.mockResolvedValue('voucher-issue-electronic-hash');
    callRpcMock.mockResolvedValueOnce({ tenant_id: 'tenant-a', enterprise_id: 'enterprise-a', mall_id: 'mall-a' }).mockResolvedValueOnce({ issueBatch: { id: 'batch-electronic', status: 'issued' } });
    const response = await handleIssueAdminVoucherBatch(
      new Request('https://smart.example/api/v1/admin/voucher-reserves/reserve-a/issue', {
        method: 'POST',
        headers: { 'idempotency-key': 'issue-electronic-a' },
        body: JSON.stringify({ cardPoolId: null }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherIssue], new Date().toISOString()),
      'reserve-a',
      'issue-electronic'
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ issueBatch: { id: 'batch-electronic', status: 'issued' } });
    expect(callRpcMock).toHaveBeenNthCalledWith(1, {}, 'api_voucher_reserve_authorization_scope', { p_reserve_request_id: 'reserve-a' });
    expect(callRpcMock).toHaveBeenNthCalledWith(
      2,
      {},
      'api_issue_voucher_batch_authorized',
      expect.objectContaining({
        p_card_pool_id: null,
        p_request_hash: 'voucher-issue-electronic-hash',
        p_idempotency_key: 'issue-electronic-a',
      })
    );
  });

  it('redeems only after resolving the voucher scope on the server, recording a deterministic idempotency request', async () => {
    callRpcMock.mockReset();
    sha256Mock.mockReset();
    sha256Mock.mockResolvedValue('voucher-redemption-hash');
    callRpcMock.mockResolvedValueOnce({ id: 'voucher-a', tenant_id: 'tenant-a', enterprise_id: 'enterprise-a', mall_id: 'mall-a' }).mockResolvedValueOnce({ id: 'redemption-a', status: 'confirmed', redeemedAmountCents: 5000 });
    const response = await handleRedeemAdminVoucher(
      new Request('https://smart.example/api/v1/admin/voucher-redemptions', {
        method: 'POST',
        headers: { 'idempotency-key': 'redeem-a', 'user-agent': 'voucher-test' },
        body: JSON.stringify({ voucherCode: 'sw-0001', amountCents: 5000, merchantReference: 'POS-001' }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherRedeem], new Date().toISOString()),
      'redeem-authorized'
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ id: 'redemption-a', status: 'confirmed' });
    expect(callRpcMock).toHaveBeenNthCalledWith(1, {}, 'api_voucher_code_authorization_scope', { p_voucher_code: 'SW-0001' });
    expect(callRpcMock).toHaveBeenNthCalledWith(
      2,
      {},
      'api_redeem_voucher_authorized',
      expect.objectContaining({
        p_membership_id: 'membership-voucher-admin',
        p_operator_user_id: 'user-a',
        p_voucher_id: 'voucher-a',
        p_amount_cents: 5000,
        p_merchant_reference: 'POS-001',
        p_idempotency_key: 'redeem-a',
        p_request_hash: 'voucher-redemption-hash',
      })
    );
  });

  it('refuses a redemption reversal when the resolved redemption is outside the operator scope', async () => {
    callRpcMock.mockReset();
    callRpcMock.mockResolvedValueOnce({ tenant_id: 'tenant-b', enterprise_id: 'enterprise-b', mall_id: 'mall-b' });
    const response = await handleReverseAdminVoucherRedemption(
      new Request('https://smart.example/api/v1/admin/voucher-redemptions/redemption-b/reversal', {
        method: 'POST',
        headers: { 'idempotency-key': 'reverse-b' },
        body: JSON.stringify({ reason: '门店重复扫码' }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherRedemptionReverse], new Date().toISOString()),
      'redemption-b',
      'reversal-cross-scope'
    );
    expect(response.status).toBe(403);
    expect(callRpcMock).toHaveBeenCalledTimes(1);
    expect(callRpcMock).toHaveBeenCalledWith({}, 'api_voucher_redemption_authorization_scope', { p_redemption_id: 'redemption-b' });
  });

  it('does not load or reconcile a void-balance hold without fresh step-up authentication', async () => {
    callRpcMock.mockReset();
    const response = await handleReconcileAdminVoucherVoidHold(
      new Request('https://smart.example/api/v1/admin/voucher-void-holds/hold-a/reconcile', {
        method: 'POST',
        headers: { 'idempotency-key': 'void-hold-no-step-up' },
        body: JSON.stringify({ reconciliationReference: 'FIN-20260817-001', reconciliationNote: '已完成线下核验' }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherReconcile]),
      'hold-a',
      'void-hold-step-up-required'
    );
    expect(response.status).toBe(403);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('reconciles an in-scope void-balance hold only after server scope resolution', async () => {
    callRpcMock.mockReset();
    sha256Mock.mockReset();
    sha256Mock.mockResolvedValue('voucher-void-hold-hash');
    callRpcMock.mockResolvedValueOnce({ tenant_id: 'tenant-a', enterprise_id: 'enterprise-a', mall_id: 'mall-a' }).mockResolvedValueOnce({ voidBalanceHold: { id: 'hold-a', status: 'reconciled' } });
    const response = await handleReconcileAdminVoucherVoidHold(
      new Request('https://smart.example/api/v1/admin/voucher-void-holds/hold-a/reconcile', {
        method: 'POST',
        headers: { 'idempotency-key': 'void-hold-a' },
        body: JSON.stringify({ reconciliationReference: 'FIN-20260817-001', reconciliationNote: '已完成线下核验' }),
      }),
      {},
      contextWithPermissions([PERMISSIONS.voucherReconcile], new Date().toISOString()),
      'hold-a',
      'void-hold-authorized'
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ voidBalanceHold: { id: 'hold-a', status: 'reconciled' } });
    expect(callRpcMock).toHaveBeenNthCalledWith(1, {}, 'api_voucher_void_hold_authorization_scope', { p_void_hold_id: 'hold-a' });
    expect(callRpcMock).toHaveBeenNthCalledWith(
      2,
      {},
      'api_reconcile_voucher_void_hold_authorized',
      expect.objectContaining({
        p_void_hold_id: 'hold-a',
        p_reconciliation_reference: 'FIN-20260817-001',
        p_reconciliation_note: '已完成线下核验',
        p_idempotency_key: 'void-hold-a',
        p_request_hash: 'voucher-void-hold-hash',
      })
    );
  });
});
