import { isJsonRecord, requestAdminJson } from './adminJson';

export type ControlSettings = {
  configured: boolean;
  operationsNotice: string | null;
  orderAttentionThreshold: number | null;
  version: number;
  updatedAt: string | null;
};

export type ControlCenterData = {
  sales: Record<string, unknown>;
  settings: ControlSettings;
  capabilities: { canManageSettings: boolean };
};

export type DistributionChannel = {
  id: string;
  code: string;
  name: string;
  status: 'pending_setup' | 'active' | 'paused' | 'disabled';
  distributorId: string | null;
  sourceReference: string;
  createdAt: string;
  updatedAt: string;
};

export type DistributionOrderAttribution = {
  id: string;
  channelId: string;
  channelName: string;
  orderId: string;
  orderNo: string;
  orderStatus: string;
  commissionStatus: 'not_ready' | 'pending_source' | 'calculated' | 'locked';
  recordedAt: string;
};

export type DistributionHubData = {
  channels: DistributionChannel[];
  orderAttributions: DistributionOrderAttribution[];
  capabilities: { canManageChannels: boolean; settlementWritable: false };
};

export type PartnerCatalogConnection = {
  id: string;
  providerCode: string;
  displayName: string;
  externalCatalogReference: string;
  status: 'pending_credentials' | 'awaiting_approval' | 'active' | 'disabled' | 'error';
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerCatalogSyncRun = {
  id: string;
  connectionId: string;
  displayName: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked';
  sourceItemCount: number | null;
  importedItemCount: number | null;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type PartnerCatalogPool = { id: string; code: string; name: string; status: string; itemCount: number };

export type PartnerCatalogHubData = {
  connections: PartnerCatalogConnection[];
  syncRuns: PartnerCatalogSyncRun[];
  catalogPools: PartnerCatalogPool[];
  capabilities: { canManageConnections: boolean; externalSyncWritable: false };
};

export async function loadControlCenter(): Promise<ControlCenterData> {
  return requestAdminJson('/api/v1/admin/control-center', { label: '智慧翼中控台', validate: isControlCenterData });
}

export async function saveControlSettings(input: { expectedVersion: number; operationsNotice: string; orderAttentionThreshold: number }): Promise<ControlSettings> {
  const payload = await requestAdminJson<{ setting: ControlSettings }>('/api/v1/admin/control-center/settings', {
    label: '中控配置',
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
    validate: (value): value is { setting: ControlSettings } => isJsonRecord(value) && isControlSettings(value.setting),
  });
  return payload.setting;
}

export async function loadDistributionHub(): Promise<DistributionHubData> {
  return requestAdminJson('/api/v1/admin/distribution', { label: '渠道与分销系统', validate: isDistributionHubData });
}

export async function createDistributionChannel(input: { code: string; name: string; distributorId: string; sourceReference: string }): Promise<DistributionChannel> {
  const payload = await requestAdminJson<{ channel: DistributionChannel }>('/api/v1/admin/distribution/channels', {
    label: '渠道资料',
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
    validate: (value): value is { channel: DistributionChannel } => isJsonRecord(value) && isDistributionChannel(value.channel),
  });
  return payload.channel;
}

export async function loadPartnerCatalogHub(): Promise<PartnerCatalogHubData> {
  return requestAdminJson('/api/v1/admin/partner-catalog', { label: '甲方商品池接入', validate: isPartnerCatalogHubData });
}

export async function createPartnerCatalogConnection(input: { providerCode: string; displayName: string; externalCatalogReference: string }): Promise<PartnerCatalogConnection> {
  const payload = await requestAdminJson<{ connection: PartnerCatalogConnection }>('/api/v1/admin/partner-catalog/connections', {
    label: '甲方商品池配置',
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
    validate: (value): value is { connection: PartnerCatalogConnection } => isJsonRecord(value) && isPartnerCatalogConnection(value.connection),
  });
  return payload.connection;
}

function isControlCenterData(value: unknown): value is ControlCenterData {
  return isJsonRecord(value) && isJsonRecord(value.sales) && isControlSettings(value.settings) && isJsonRecord(value.capabilities) && typeof value.capabilities.canManageSettings === 'boolean';
}

function isControlSettings(value: unknown): value is ControlSettings {
  return (
    isJsonRecord(value) &&
    typeof value.configured === 'boolean' &&
    (typeof value.operationsNotice === 'string' || value.operationsNotice === null) &&
    (typeof value.orderAttentionThreshold === 'number' || value.orderAttentionThreshold === null) &&
    typeof value.version === 'number' &&
    (typeof value.updatedAt === 'string' || value.updatedAt === null)
  );
}

function isDistributionHubData(value: unknown): value is DistributionHubData {
  return (
    isJsonRecord(value) &&
    Array.isArray(value.channels) &&
    value.channels.every(isDistributionChannel) &&
    Array.isArray(value.orderAttributions) &&
    value.orderAttributions.every(isDistributionOrderAttribution) &&
    isJsonRecord(value.capabilities) &&
    typeof value.capabilities.canManageChannels === 'boolean' &&
    value.capabilities.settlementWritable === false
  );
}

function isDistributionChannel(value: unknown): value is DistributionChannel {
  return isJsonRecord(value) && typeof value.id === 'string' && typeof value.code === 'string' && typeof value.name === 'string' && ['pending_setup', 'active', 'paused', 'disabled'].includes(String(value.status)) && (typeof value.distributorId === 'string' || value.distributorId === null) && typeof value.sourceReference === 'string' && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string';
}

function isDistributionOrderAttribution(value: unknown): value is DistributionOrderAttribution {
  return isJsonRecord(value) && typeof value.id === 'string' && typeof value.channelId === 'string' && typeof value.channelName === 'string' && typeof value.orderId === 'string' && typeof value.orderNo === 'string' && typeof value.orderStatus === 'string' && ['not_ready', 'pending_source', 'calculated', 'locked'].includes(String(value.commissionStatus)) && typeof value.recordedAt === 'string';
}

function isPartnerCatalogHubData(value: unknown): value is PartnerCatalogHubData {
  return (
    isJsonRecord(value) &&
    Array.isArray(value.connections) &&
    value.connections.every(isPartnerCatalogConnection) &&
    Array.isArray(value.syncRuns) &&
    value.syncRuns.every(isPartnerCatalogSyncRun) &&
    Array.isArray(value.catalogPools) &&
    value.catalogPools.every(isPartnerCatalogPool) &&
    isJsonRecord(value.capabilities) &&
    typeof value.capabilities.canManageConnections === 'boolean' &&
    value.capabilities.externalSyncWritable === false
  );
}

function isPartnerCatalogConnection(value: unknown): value is PartnerCatalogConnection {
  return isJsonRecord(value) && typeof value.id === 'string' && typeof value.providerCode === 'string' && typeof value.displayName === 'string' && typeof value.externalCatalogReference === 'string' && ['pending_credentials', 'awaiting_approval', 'active', 'disabled', 'error'].includes(String(value.status)) && (typeof value.lastCheckedAt === 'string' || value.lastCheckedAt === null) && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string';
}

function isPartnerCatalogSyncRun(value: unknown): value is PartnerCatalogSyncRun {
  return isJsonRecord(value) && typeof value.id === 'string' && typeof value.connectionId === 'string' && typeof value.displayName === 'string' && ['queued', 'running', 'succeeded', 'failed', 'blocked'].includes(String(value.status)) && (typeof value.sourceItemCount === 'number' || value.sourceItemCount === null) && (typeof value.importedItemCount === 'number' || value.importedItemCount === null) && typeof value.message === 'string' && (typeof value.startedAt === 'string' || value.startedAt === null) && (typeof value.finishedAt === 'string' || value.finishedAt === null) && typeof value.createdAt === 'string';
}

function isPartnerCatalogPool(value: unknown): value is PartnerCatalogPool {
  return isJsonRecord(value) && typeof value.id === 'string' && typeof value.code === 'string' && typeof value.name === 'string' && typeof value.status === 'string' && typeof value.itemCount === 'number';
}
