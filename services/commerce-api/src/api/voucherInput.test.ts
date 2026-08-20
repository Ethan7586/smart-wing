import { describe, expect, it } from 'vitest';
import { parseApprovalInput, parseIssueInput, parseReserveInput, parseVoidHoldReconciliationInput } from './voucherInput';

// These parsers used to carry their own isRecord and optionalString. Both
// disagreed with the shared primitives, and the difference was reachable from
// the network: a JSON array body and a blank evidence string both got through.

describe('voucher parsers reject an array body', () => {
  it('refuses an array where a reserve request object is required', () => {
    expect(parseReserveInput([])).toBeNull();
    expect(parseReserveInput([{ voucherProgramId: 'program-a', quantity: 1, reason: '备券' }])).toBeNull();
  });

  it('refuses an array on the issue path, which has the loosest field checks', () => {
    expect(parseIssueInput([])).toBeNull();
  });

  it('refuses an array on the void-hold reconciliation path', () => {
    expect(parseVoidHoldReconciliationInput([])).toBeNull();
  });
});

describe('voucher parsers reject a blank optional field', () => {
  const approval = { decision: 'approved' as const, reason: '额度充足' };

  it('accepts an omitted evidence field as absent', () => {
    expect(parseApprovalInput({ ...approval })).toEqual({ decision: 'approved', reason: '额度充足', evidence: null });
  });

  it('accepts an explicit null evidence field as absent', () => {
    expect(parseApprovalInput({ ...approval, evidence: null })?.evidence).toBeNull();
  });

  it('refuses a blank evidence string instead of recording it as absent', () => {
    expect(parseApprovalInput({ ...approval, evidence: '' })).toBeNull();
    expect(parseApprovalInput({ ...approval, evidence: '   ' })).toBeNull();
  });

  it('refuses a blank card pool id rather than issuing an electronic batch by accident', () => {
    expect(parseIssueInput({ cardPoolId: '' })).toBeNull();
    expect(parseIssueInput({ cardPoolId: null })).toEqual({ cardPoolId: null });
  });

  it('keeps a supplied evidence value', () => {
    expect(parseApprovalInput({ ...approval, evidence: ' 工单 A-12 ' })?.evidence).toBe('工单 A-12');
  });
});
