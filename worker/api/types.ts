export interface WorkerEnv {
  ASSETS?: Fetcher;
  DB: D1Database;
  APP_ENV?: string;
  AUTH_MODE?: string;
  PII_ENCRYPTION_KEY?: string;
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
