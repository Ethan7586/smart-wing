import type { Membership, Permission } from '@smart-wing/api-contract';

export interface WorkerEnv {
  ASSETS?: Fetcher;
  SUPABASE_URL?: string;
  /** Provider region used only for health and operations reporting. */
  SUPABASE_REGION?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_ENV?: string;
  AUTH_MODE?: string;
  /** Public member registration is fail-closed in production unless enabled. */
  SELF_REGISTRATION_ENABLED?: string;
  /** Username/password registration has its own production release switch. */
  USERNAME_REGISTRATION_ENABLED?: string;
  /** Debug OTP is permitted only outside production. A real SMS provider follows. */
  SMS_PROVIDER?: string;
  /** Exact test-client IPs that may skip only the login failure limiter. */
  TEST_LOGIN_RATE_LIMIT_BYPASS_IPS?: string;
  /** Required ISO timestamp at which the temporary bypass begins. */
  TEST_LOGIN_RATE_LIMIT_BYPASS_FROM?: string;
  /** Required ISO timestamp after which the test-client bypass fails closed. */
  TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL?: string;
  PII_ENCRYPTION_KEY?: string;
  SESSION_SIGNING_KEY?: string;
  /** Stable pepper for phone lookup and one-time verification hashes. */
  IDENTITY_LOOKUP_KEY?: string;
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
