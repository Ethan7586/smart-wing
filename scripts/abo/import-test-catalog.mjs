import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TENANT_ID = 'tenant-smart-wing';
const MALL_ID = 'mall-demo';
const SUPPLIER_ID = 'supplier-test-abo';

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/+$/, '');
}

async function rest(path, options = {}) {
  const baseUrl = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${await response.text()}`);
  }
}

async function upsert(table, rows) {
  if (!rows.length) return;
  await rest(`${table}?on_conflict=id`, {
    method: 'POST',
    body: JSON.stringify(rows),
  });
}

async function upsertInventory(rows) {
  if (!rows.length) return;
  await rest('inventory?on_conflict=sku_id', {
    method: 'POST',
    body: JSON.stringify(rows),
  });
}

function productRow(item) {
  return {
    id: item.id,
    tenant_id: TENANT_ID,
    mall_id: MALL_ID,
    supplier_id: SUPPLIER_ID,
    spu_code: `ABO-${item.externalId}`,
    name: item.name,
    subtitle: item.subtitle,
    category_code: item.categoryCode,
    cover_url: item.coverUrl,
    detail_json: {
      brand: item.brand,
      model: item.model,
      productType: item.productType,
      description: item.description,
      source: item.source,
    },
    status: 'active',
    is_test: true,
  };
}

function skuRow(item) {
  return {
    id: `sku_${item.id}`,
    tenant_id: TENANT_ID,
    mall_id: MALL_ID,
    product_id: item.id,
    sku_code: `ABO-SKU-${item.externalId}`,
    specs_json: { 数据状态: '测试数据' },
    price_cents: 0,
    market_price_cents: null,
    status: 'active',
  };
}

function inventoryRow(item) {
  return {
    tenant_id: TENANT_ID,
    mall_id: MALL_ID,
    sku_id: `sku_${item.id}`,
    available_qty: 0,
    reserved_qty: 0,
  };
}

async function main() {
  const input = resolve(readArg('input', '.codex-temp/abo/test-products.jsonl'));
  const batchSize = Number.parseInt(readArg('batch', '200'), 10);
  const lines = (await readFile(input, 'utf8')).split(/\r?\n/).filter(Boolean);
  const products = lines.map((line) => JSON.parse(line));

  await upsert('suppliers', [
    {
      id: SUPPLIER_ID,
      tenant_id: TENANT_ID,
      code: 'ABO_TEST',
      name: 'ABO非商业测试数据',
      settlement_mode: 'none',
      status: 'active',
    },
  ]);

  for (let offset = 0; offset < products.length; offset += batchSize) {
    const batch = products.slice(offset, offset + batchSize);
    await upsert('products', batch.map(productRow));
    await upsert('skus', batch.map(skuRow));
    await upsertInventory(batch.map(inventoryRow));
    console.log(`Imported ${Math.min(offset + batch.length, products.length)}/${products.length}`);
  }
}

await main();
