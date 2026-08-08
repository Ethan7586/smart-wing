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
  DEMO_LOGIN_CODE?: string;
}

export interface Actor {
  tenantId: string;
  enterpriseId: string;
  mallId: string;
  mallCode: string;
  userId: string;
  employeeNo: string;
  roles: string[];
  permissions: string[];
}

export interface RequestContext {
  requestId: string;
  actor: Actor | null;
}
