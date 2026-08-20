export interface CreateDistributorInput {
  code: string;
  name: string;
  contact: Record<string, unknown>;
  settlementMode: 'manual' | 'service_provider';
  metadata: Record<string, unknown>;
  reason: string;
}

export interface AttachDistributorTenantInput {
  tenantId: string;
  startsAt: string | null;
  endsAt: string | null;
  agreementEvidence: Record<string, unknown>;
  reason: string;
}

export function parseCreateDistributor(value: unknown): CreateDistributorInput | null {
  const record = object(value);
  if (!record) return null;
  const code = text(record.code, 3, 40)?.toLowerCase();
  const name = text(record.name, 2, 120);
  const reason = text(record.reason, 4, 300);
  const settlementMode = record.settlementMode ?? 'manual';
  const contact = object(record.contact ?? {}) ?? null;
  const metadata = object(record.metadata ?? {}) ?? null;
  if (!code || !/^[a-z0-9][a-z0-9_-]{2,39}$/.test(code) || !name || !reason || !contact || !metadata) return null;
  if (settlementMode !== 'manual' && settlementMode !== 'service_provider') return null;
  return { code, name, contact, settlementMode, metadata, reason };
}

export function parseAttachDistributorTenant(value: unknown): AttachDistributorTenantInput | null {
  const record = object(value);
  if (!record) return null;
  const tenantId = text(record.tenantId, 1, 120);
  const reason = text(record.reason, 4, 300);
  const startsAt = optionalTimestamp(record.startsAt);
  const endsAt = optionalTimestamp(record.endsAt);
  const agreementEvidence = object(record.agreementEvidence ?? {}) ?? null;
  if (!tenantId || !reason || startsAt === undefined || endsAt === undefined || !agreementEvidence) return null;
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return null;
  return { tenantId, startsAt, endsAt, agreementEvidence, reason };
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length >= minimum && normalized.length <= maximum ? normalized : null;
}

function optionalTimestamp(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined;
}
