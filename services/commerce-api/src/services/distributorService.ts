import { callRpc } from '../api/supabase';
import type { AttachDistributorTenantInput, CreateDistributorInput } from '../api/distributorModel';
import type { AuthorizationContext, WorkerEnv } from '../api/types';

interface MutationEvidence {
  requestId: string;
  requestHash: string;
  idempotencyKey: string;
  userAgent: string;
}

export function loadPlatformDistributors(env: WorkerEnv, authorization: AuthorizationContext): Promise<Record<string, unknown>> {
  return callRpc(env, 'api_platform_distributors', {
    p_actor_membership_id: authorization.membership.id,
    p_actor_user_id: authorization.userId,
  });
}

export function createDistributor(env: WorkerEnv, authorization: AuthorizationContext, input: CreateDistributorInput, evidence: MutationEvidence): Promise<Record<string, unknown>> {
  return callRpc(env, 'api_platform_create_distributor', {
    p_actor_membership_id: authorization.membership.id,
    p_actor_user_id: authorization.userId,
    p_code: input.code,
    p_name: input.name,
    p_contact_json: input.contact,
    p_settlement_mode: input.settlementMode,
    p_metadata_json: input.metadata,
    p_reason: input.reason,
    p_idempotency_key: evidence.idempotencyKey,
    p_request_hash: evidence.requestHash,
    p_request_id: evidence.requestId,
    p_user_agent: evidence.userAgent,
  });
}

export function attachDistributorTenant(env: WorkerEnv, authorization: AuthorizationContext, distributorId: string, input: AttachDistributorTenantInput, evidence: MutationEvidence): Promise<Record<string, unknown>> {
  return callRpc(env, 'api_platform_attach_tenant_to_distributor', {
    p_actor_membership_id: authorization.membership.id,
    p_actor_user_id: authorization.userId,
    p_distributor_id: distributorId,
    p_tenant_id: input.tenantId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_agreement_evidence_json: input.agreementEvidence,
    p_reason: input.reason,
    p_idempotency_key: evidence.idempotencyKey,
    p_request_hash: evidence.requestHash,
    p_request_id: evidence.requestId,
    p_user_agent: evidence.userAgent,
  });
}

export function loadDistributorCenter(env: WorkerEnv, authorization: AuthorizationContext, tenantId: string | null): Promise<Record<string, unknown>> {
  return callRpc(env, 'api_distributor_center', {
    p_actor_membership_id: authorization.membership.id,
    p_actor_user_id: authorization.userId,
    p_distributor_id: authorization.distributorId,
    p_tenant_id: tenantId,
  });
}
