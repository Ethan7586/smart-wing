import { hasArrayProperties, hasRecordProperties, isJsonRecord } from './adminJson';
import type {
  Brand,
  CatalogPool,
  CityZone,
  EmployeeQualification,
  EntitlementPolicy,
  Option,
  PurchaseLimit,
  QualificationCenterData,
  QualificationChangeRequest,
  QualificationGovernanceData,
  QualificationImpactPreview,
  QualificationSelector,
  QualificationStatus,
  StoreResource,
  SupplierAgreement,
} from './qualification';

export function isQualificationCenterData(payload: unknown): payload is QualificationCenterData {
  if (!hasArrayProperties(payload, ['catalogPools', 'cityZones', 'policies', 'limitTemplates']) || !hasRecordProperties(payload, ['commercialResources', 'selectors', 'commercialSummary', 'capabilities'])) {
    return false;
  }
  const resources = payload.commercialResources;
  const selectors = payload.selectors;
  return (
    payload.catalogPools.every(isCatalogPool) &&
    payload.cityZones.every(isCityZone) &&
    payload.policies.every(isEntitlementPolicy) &&
    payload.limitTemplates.every(isPurchaseLimit) &&
    hasArrayProperties(resources, ['agreements', 'brands', 'stores']) &&
    resources.agreements.every(isSupplierAgreement) &&
    resources.brands.every(isBrand) &&
    resources.stores.every(isStoreResource) &&
    hasArrayProperties(selectors, ['enterprises', 'suppliers', 'products', 'skus', 'departments', 'users', 'memberships']) &&
    Object.values(selectors).every((options) => Array.isArray(options) && options.every(isOption)) &&
    hasNumberFields(payload.commercialSummary, ['brands', 'stores', 'supplierAgreements', 'brandAuthorizations']) &&
    hasBooleanFields(payload.capabilities, [
      'readCommercialResources',
      'manageCommercialResources',
      'readEntitlements',
      'manageEntitlements',
      'readPurchaseLimits',
      'managePurchaseLimits',
      'readEmployees',
      'manageEmployees',
      'approveChanges',
      'simulate',
    ])
  );
}

export function isQualificationGovernanceData(payload: unknown): payload is QualificationGovernanceData {
  return (
    hasArrayProperties(payload, ['changeRequests', 'employees']) &&
    isJsonRecord(payload) &&
    payload.changeRequests.every(isChangeRequest) &&
    payload.employees.every(isEmployeeQualification) &&
    isJsonRecord(payload.capabilities) &&
    hasBooleanFields(payload.capabilities, ['readEmployees', 'manageEmployees', 'approveChanges', 'simulate']) &&
    typeof payload.currentMembershipId === 'string'
  );
}

function isCatalogPool(value: unknown): value is CatalogPool {
  return (
    hasStringFields(value, ['id', 'code', 'name']) &&
    isOneOf(value.kind, ['selected', 'combined']) &&
    isQualificationStatus(value.status) &&
    isNonNegativeInteger(value.version) &&
    isStringList(value.skuIds) &&
    isNonNegativeInteger(value.itemCount)
  );
}

function isCityZone(value: unknown): value is CityZone {
  return (
    hasStringFields(value, ['id', 'code', 'name']) &&
    isOneOf(value.appliesTo, ['visible', 'purchasable', 'both']) &&
    isQualificationStatus(value.status) &&
    isNonNegativeInteger(value.version) &&
    Array.isArray(value.cities) &&
    value.cities.every((city) => hasStringFields(city, ['code', 'name'])) &&
    isSelectorList(value.resources) &&
    isNonNegativeInteger(value.cityCount) &&
    isNonNegativeInteger(value.itemCount)
  );
}

function isEntitlementPolicy(value: unknown): value is EntitlementPolicy {
  return (
    hasStringFields(value, ['id', 'name', 'reasonCode']) &&
    isOneOf(value.action, ['visible', 'purchasable']) &&
    isOneOf(value.effect, ['allow', 'deny']) &&
    isFiniteNumber(value.priority) &&
    isQualificationStatus(value.status) &&
    isNonNegativeInteger(value.version) &&
    isSelectorList(value.subjects) &&
    isSelectorList(value.resources) &&
    isNonNegativeInteger(value.subjectCount) &&
    isNonNegativeInteger(value.resourceCount)
  );
}

function isPurchaseLimit(value: unknown): value is PurchaseLimit {
  return (
    hasStringFields(value, ['id', 'code', 'name']) &&
    isOneOf(value.countScope, ['sku', 'product']) &&
    isQualificationStatus(value.status) &&
    isNonNegativeInteger(value.version) &&
    [value.maxPerOrderQty, value.maxDailyQty, value.maxMonthlyQty, value.maxLifetimeQty, value.maxPerOrderAmountCents, value.maxDailyAmountCents, value.maxMonthlyAmountCents, value.maxLifetimeAmountCents].every(
      isNullableNonNegativeInteger
    ) &&
    isSelectorList(value.subjects) &&
    isSelectorList(value.resources)
  );
}

function isSupplierAgreement(value: unknown): value is SupplierAgreement {
  return hasStringFields(value, ['id', 'supplierId', 'agreementCode', 'settlementMode']) && isQualificationStatus(value.status) && isNonNegativeInteger(value.version);
}

function isBrand(value: unknown): value is Brand {
  return (
    hasStringFields(value, ['id', 'code', 'name']) &&
    isQualificationStatus(value.status) &&
    isNonNegativeInteger(value.version) &&
    isStringList(value.supplierIds) &&
    isStringList(value.productIds) &&
    typeof value.authorizedInMall === 'boolean'
  );
}

function isStoreResource(value: unknown): value is StoreResource {
  return (
    hasStringFields(value, ['id', 'code', 'name']) &&
    isOneOf(value.storeType, ['online', 'offline', 'hybrid']) &&
    isNullableString(value.provinceCode) &&
    isNullableString(value.cityCode) &&
    isNullableString(value.addressText) &&
    isQualificationStatus(value.status) &&
    isNonNegativeInteger(value.version) &&
    isStringList(value.brandIds)
  );
}

function isOption(value: unknown): value is Option {
  return hasStringFields(value, ['id', 'name']) && (value.productId === undefined || typeof value.productId === 'string');
}

function isChangeRequest(value: unknown): value is QualificationChangeRequest {
  return (
    hasStringFields(value, ['id', 'reason', 'riskLevel', 'requesterName', 'requesterMembershipId', 'createdAt']) &&
    isOneOf(value.kind, ['catalog_pool', 'supplier_agreement', 'brand', 'store', 'city_zone', 'entitlement_policy', 'purchase_limit']) &&
    isNullableString(value.entityId) &&
    isNonNegativeInteger(value.expectedVersion) &&
    isQualificationStatus(value.requestedStatus) &&
    isOneOf(value.status, ['pending', 'rejected', 'applied', 'stale', 'cancelled']) &&
    isImpactPreview(value.preview) &&
    isNullableString(value.reviewerName) &&
    isNullableString(value.reviewReason) &&
    isNullableString(value.reviewedAt)
  );
}

function isImpactPreview(value: unknown): value is QualificationImpactPreview {
  return (
    isJsonRecord(value) &&
    typeof value.requiresApproval === 'boolean' &&
    isOneOf(value.riskLevel, ['elevated', 'high', 'critical']) &&
    isNonNegativeInteger(value.affectedEmployees) &&
    isNonNegativeInteger(value.affectedSkus) &&
    isNullableString(value.currentStatus) &&
    typeof value.requestedStatus === 'string' &&
    isStringList(value.reasons)
  );
}

function isEmployeeQualification(value: unknown): value is EmployeeQualification {
  return (
    hasStringFields(value, ['userId', 'membershipId', 'name', 'employeeNo']) &&
    isNullableString(value.departmentId) &&
    isNullableString(value.departmentName) &&
    isNullableString(value.cityCode) &&
    isNullableString(value.cityName) &&
    isOneOf(value.status, ['active', 'disabled']) &&
    isNonNegativeInteger(value.version) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => hasStringFields(tag, ['code', 'source']) && isNullableString(tag.startsAt) && isNullableString(tag.endsAt))
  );
}

function isSelectorList(value: unknown): value is QualificationSelector[] {
  return Array.isArray(value) && value.every((selector) => hasStringFields(selector, ['kind', 'id']));
}

function isQualificationStatus(value: unknown): value is QualificationStatus {
  return isOneOf(value, ['draft', 'active', 'disabled']);
}

function hasStringFields(value: unknown, fields: string[]): value is Record<string, string> {
  return isJsonRecord(value) && fields.every((field) => typeof value[field] === 'string');
}

function hasNumberFields(value: unknown, fields: string[]): value is Record<string, number> {
  return isJsonRecord(value) && fields.every((field) => isNonNegativeInteger(value[field]));
}

function hasBooleanFields(value: unknown, fields: string[]): value is Record<string, boolean> {
  return isJsonRecord(value) && fields.every((field) => typeof value[field] === 'boolean');
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
