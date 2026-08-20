import { ADMIN_ORDER_STATUS_VALUES } from '@smart-wing/api-contract';

export const ORDER_STATUSES = ADMIN_ORDER_STATUS_VALUES;
export const AFTER_SALE_STATUSES = ['submitted', 'reviewing', 'approved', 'rejected', 'returning', 'completed', 'closed'] as const;
const SORTS = ['created_at_desc', 'created_at_asc', 'payable_desc', 'payable_asc'] as const;

export type AdminOrderQuery = {
  keyword: string | null;
  status: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  sort: (typeof SORTS)[number];
  limit: number;
  offset: number;
};

export type QueryParseResult = { ok: true; value: AdminOrderQuery } | { ok: false; code: 'INVALID_STATUS' | 'INVALID_DATE' | 'INVALID_QUERY' };

export function parseAdminOrderQuery(url: URL, statuses: readonly string[]): QueryParseResult {
  const keyword = readText(url.searchParams.get('keyword'), 100);
  if (keyword === undefined) return { ok: false, code: 'INVALID_QUERY' };
  const status = readText(url.searchParams.get('status'), 40);
  if (status === undefined) return { ok: false, code: 'INVALID_QUERY' };
  if (status && !statuses.includes(status)) return { ok: false, code: 'INVALID_STATUS' };
  const createdFrom = readDate(url.searchParams.get('createdFrom'));
  const createdTo = readDate(url.searchParams.get('createdTo'));
  if (createdFrom === undefined || createdTo === undefined) return { ok: false, code: 'INVALID_DATE' };
  const rawSort = url.searchParams.get('sort') ?? 'created_at_desc';
  if (!SORTS.includes(rawSort as (typeof SORTS)[number])) return { ok: false, code: 'INVALID_QUERY' };
  return { ok: true, value: { keyword, status, createdFrom, createdTo, sort: rawSort as AdminOrderQuery['sort'], limit: readLimit(url.searchParams.get('limit')), offset: readOffset(url.searchParams.get('offset')) } };
}

function readText(value: string | null, maximumLength: number): string | null | undefined {
  if (value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return normalized.length <= maximumLength ? normalized : undefined;
}

function readDate(value: string | null): string | null | undefined {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function readLimit(value: string | null): number {
  if (value === null) return 20;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 100;
}

function readOffset(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
