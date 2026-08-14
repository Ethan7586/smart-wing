import React, { useMemo } from 'react';
import type { Option, QualificationCenterData, QualificationSelector } from '../../services/qualification';
import { CheckboxOptions, FormGrid, SelectorGroup, SelectField, TextArea, TextField, Toggle } from './QualificationFormControls';
import { LIMIT_KEYS, selectors, strings, text } from './qualificationConfigModel';

type Setter = (key: string, value: unknown) => void;
export function CatalogPoolEditor({ form, set, data }: Props) {
  return (
    <div className="space-y-5">
      <FormGrid>
        <Common form={form} set={set} />
        <SelectField
          label="商品池类型"
          value={text(form.poolKind)}
          onChange={(value) => set('poolKind', value)}
          options={[
            ['selected', '商城精选池'],
            ['combined', '组合商品池'],
          ]}
        />
      </FormGrid>
      <CheckboxOptions label="选择 SKU" options={data.selectors.skus} values={strings(form.skuIds)} onChange={(value) => set('skuIds', value)} />
    </div>
  );
}
export function CityZoneEditor({ form, set, data }: Props) {
  return (
    <div className="space-y-5">
      <FormGrid>
        <Common form={form} set={set} />
        <SelectField
          label="控制范围"
          value={text(form.appliesTo)}
          onChange={(value) => set('appliesTo', value)}
          options={[
            ['both', '可见 + 可买'],
            ['visible', '仅可见'],
            ['purchasable', '仅可买'],
          ]}
        />
      </FormGrid>
      <TextArea label="城市清单" hint="每行一个：城市代码|城市名称，例如 310100|上海市" value={text(form.citiesText)} onChange={(value) => set('citiesText', value)} />
      <ResourceChecks values={selectors(form.resources)} onChange={(value) => set('resources', value)} data={data} allowed={['product', 'sku']} />
    </div>
  );
}
export function PolicyEditor({ form, set, data }: Props) {
  return (
    <div className="space-y-5">
      <FormGrid>
        <TextField label="策略名称" value={text(form.name)} onChange={(value) => set('name', value)} />
        <SelectField
          label="员工动作"
          value={text(form.action)}
          onChange={(value) => set('action', value)}
          options={[
            ['visible', '是否可见'],
            ['purchasable', '是否可买'],
          ]}
        />
        <SelectField
          label="策略效果"
          value={text(form.effect)}
          onChange={(value) => set('effect', value)}
          options={[
            ['allow', '允许'],
            ['deny', '明确拒绝（优先）'],
          ]}
        />
        <TextField label="优先级" type="number" value={text(form.priority)} onChange={(value) => set('priority', value)} />
        <TextField label="原因编码" value={text(form.reasonCode)} onChange={(value) => set('reasonCode', value)} />
      </FormGrid>
      <SubjectChecks values={selectors(form.subjects)} onChange={(value) => set('subjects', value)} data={data} />
      <ResourceChecks values={selectors(form.resources)} onChange={(value) => set('resources', value)} data={data} allowed={['all', 'catalog_pool', 'product', 'sku', 'city_zone']} />
    </div>
  );
}
export function LimitEditor({ form, set, data }: Props) {
  return (
    <div className="space-y-5">
      <FormGrid>
        <Common form={form} set={set} />
        <SelectField
          label="计数口径"
          value={text(form.countScope)}
          onChange={(value) => set('countScope', value)}
          options={[
            ['sku', '按 SKU'],
            ['product', '按 SPU 商品'],
          ]}
        />
      </FormGrid>
      <section>
        <h3 className="mb-3 text-sm font-bold text-slate-800">限额（至少填写一项）</h3>
        <FormGrid>
          {LIMIT_KEYS.map((key) => (
            <TextField key={key} label={LIMIT_LABELS[key]} type="number" value={text(form[key])} onChange={(value) => set(key, value)} placeholder="留空表示不限" />
          ))}
        </FormGrid>
      </section>
      <SubjectChecks values={selectors(form.subjects)} onChange={(value) => set('subjects', value)} data={data} />
      <ResourceChecks values={selectors(form.resources)} onChange={(value) => set('resources', value)} data={data} allowed={['all', 'catalog_pool', 'product', 'sku', 'city_zone']} />
    </div>
  );
}
export function CommercialEditor({ kind, form, set, data }: Props & { kind: 'supplier_agreement' | 'brand' | 'store' }) {
  if (kind === 'supplier_agreement')
    return (
      <FormGrid>
        <SelectField label="供应商" value={text(form.supplierId)} onChange={(value) => set('supplierId', value)} options={data.selectors.suppliers.map((option) => [option.id, option.name])} />
        <TextField label="协议编号" value={text(form.agreementCode)} onChange={(value) => set('agreementCode', value)} />
        <TextField label="结算方式" value={text(form.settlementMode)} onChange={(value) => set('settlementMode', value)} placeholder="manual / monthly" />
      </FormGrid>
    );
  if (kind === 'brand')
    return (
      <div className="space-y-5">
        <FormGrid>
          <Common form={form} set={set} />
          <Toggle label="授权本商城使用" checked={Boolean(form.authorizedInMall)} onChange={(value) => set('authorizedInMall', value)} />
        </FormGrid>
        <CheckboxOptions label="关联供应商" options={data.selectors.suppliers} values={strings(form.supplierIds)} onChange={(value) => set('supplierIds', value)} />
        <CheckboxOptions label="品牌商品" options={data.selectors.products} values={strings(form.productIds)} onChange={(value) => set('productIds', value)} />
      </div>
    );
  return (
    <div className="space-y-5">
      <FormGrid>
        <Common form={form} set={set} />
        <SelectField
          label="门店类型"
          value={text(form.storeType)}
          onChange={(value) => set('storeType', value)}
          options={[
            ['online', '线上门店'],
            ['offline', '线下门店'],
            ['hybrid', '线上 + 线下'],
          ]}
        />
        <TextField label="省份代码" value={text(form.provinceCode)} onChange={(value) => set('provinceCode', value)} />
        <TextField label="城市代码" value={text(form.cityCode)} onChange={(value) => set('cityCode', value)} />
        <TextField label="地址" value={text(form.addressText)} onChange={(value) => set('addressText', value)} />
      </FormGrid>
      <CheckboxOptions label="关联品牌" options={data.commercialResources.brands.map((brand) => ({ id: brand.id, name: brand.name }))} values={strings(form.brandIds)} onChange={(value) => set('brandIds', value)} />
    </div>
  );
}

function SubjectChecks({ values, onChange, data }: SelectorProps) {
  const tagText = values
    .filter((item) => item.kind === 'tag')
    .map((item) => item.id)
    .join(', ');
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800">适用员工</h3>
      <SelectorGroup label="全部员工" kind="all" options={[{ id: '*', name: '当前商城全部员工' }]} values={values} onChange={onChange} />
      <SelectorGroup label="集团" kind="enterprise" options={data.selectors.enterprises} values={values} onChange={onChange} />
      <SelectorGroup label="部门" kind="department" options={data.selectors.departments} values={values} onChange={onChange} />
      <SelectorGroup label="指定员工" kind="user" options={data.selectors.users} values={values} onChange={onChange} />
      <SelectorGroup label="指定会员身份" kind="membership" options={data.selectors.memberships} values={values} onChange={onChange} />
      <TextField
        label="资格标签（逗号分隔）"
        value={tagText}
        onChange={(next) =>
          onChange([
            ...values.filter((item) => item.kind !== 'tag'),
            ...next
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
              .map((id) => ({ kind: 'tag', id })),
          ])
        }
        placeholder="例如：华东员工, 新员工"
      />
    </section>
  );
}
function ResourceChecks({ values, onChange, data, allowed }: SelectorProps & { allowed: string[] }) {
  const groups = useMemo(
    () =>
      [
        ['all', '全部资源', [{ id: '*', name: '商城全部商品' }]],
        ['catalog_pool', '商品池', data.catalogPools.map((item) => ({ id: item.id, name: item.name }))],
        ['product', 'SPU 商品', data.selectors.products],
        ['sku', 'SKU', data.selectors.skus],
        ['city_zone', '城市专区', data.cityZones.map((item) => ({ id: item.id, name: item.name }))],
      ] as Array<[string, string, Option[]]>,
    [data]
  );
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800">适用商品范围</h3>
      {groups
        .filter(([kind]) => allowed.includes(kind))
        .map(([kind, label, options]) => (
          <SelectorGroup key={kind} label={label} kind={kind} options={options} values={values} onChange={onChange} />
        ))}
    </section>
  );
}
function Common({ form, set }: { form: Record<string, unknown>; set: Setter }) {
  return (
    <>
      <TextField label="编码" value={text(form.code)} onChange={(value) => set('code', value)} placeholder="英文、数字、下划线" />
      <TextField label="名称" value={text(form.name)} onChange={(value) => set('name', value)} />
    </>
  );
}
type Props = { form: Record<string, unknown>; set: Setter; data: QualificationCenterData };
type SelectorProps = { values: QualificationSelector[]; onChange: (value: QualificationSelector[]) => void; data: QualificationCenterData };
const LIMIT_LABELS: Record<string, string> = {
  maxPerOrderQty: '单次最多件数',
  maxDailyQty: '每日最多件数',
  maxMonthlyQty: '每月最多件数',
  maxLifetimeQty: '累计最多件数',
  maxPerOrderAmountCents: '单次金额上限（分）',
  maxDailyAmountCents: '每日金额上限（分）',
  maxMonthlyAmountCents: '每月金额上限（分）',
  maxLifetimeAmountCents: '累计金额上限（分）',
};
