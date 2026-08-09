import type { Membership, Permission } from '@smart-wing/api-contract';

export interface WorkerEnv {
  ASSETS?: Fetcher;
  SUPABASE_URL?: string;
  /** Provider region used only for health and operations reporting. */
  SUPABASE_REGION?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_ENV?: string;
  AUTH_MODE?: string;
  PII_ENCRYPTION_KEY?: string;
  SESSION_SIGNING_KEY?: string;
  /** Separate signing key for smart.hbbtzn.com sessions. */
  ADMIN_SESSION_SIGNING_KEY?: string;
}

/**
 * Runtime projection of one resolved Membership. It is never an
 * independently-authorized principal and never contains permissions from
 * another membership.
 */
export interface AuthorizationContext {
  tenantId: string;
  enterpriseId: string;
  mallId: string;
  mallCode: string;
  userId: string;
  employeeNo: string;
  roles: string[];
  permissions: Permission[];
  membership: Membership;
  stepUpAt: string | null;
}

export interface RequestContext {
  requestId: string;
  authorization: AuthorizationContext | null;
}
