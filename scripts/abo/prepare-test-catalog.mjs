import { existsSync, mkdirSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const SOURCE_ROOT =
  "https://amazon-berkeley-objects.s3.us-east-1.amazonaws.com";
const DEFAULT_OUTPUT = ".codex-temp/abo/test-products.jsonl";

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function localized(values = []) {
  const preferences = ["zh_CN", "zh_TW", "en_US", "en_GB"];
  for (const language of preferences) {
    const match = values.find((item) => item.language_tag === language);
    if (match?.value) return match.value;
  }
  return values.find((item) => item?.value)?.value ?? "";
}

function firstValue(values = []) {
  return values.find((item) => item?.value)?.value ?? "";
}

function categoryFor(item) {
  const source = [
    ...(item.node ?? []).map((node) => node.node_name ?? node.path ?? ""),
    ...(item.product_type ?? []).map((type) => type.value ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  if (/food|grocery|beverage|snack|coffee|tea/.test(source)) return "food";
  if (/computer|electronics|phone|camera|office|keyboard/.test(source)) {
    return "digital";
  }
  if (/appliance|vacuum|kitchen|air conditioner|refrigerator/.test(source)) {
    return "appliance";
  }
  return "life";
}

function imageUrl(imageId) {
  if (!imageId) return null;
  return `https://m.media-amazon.com/images/I/${imageId}.jpg`;
}

function compactItem(item) {
  const name = localized(item.item_name);
  if (!item.item_id || !name || !item.main_image_id) return null;
  const brand = localized(item.brand) || "Amazon Berkeley Objects";
  const description =
    localized(item.product_description) ||
    localized(item.bullet_point) ||
    "Amazon Berkeley Objects 非商业测试商品。";
  return {
    id: `abo_${item.item_id.toLowerCase()}`,
    externalId: item.item_id,
    name,
    subtitle: `${brand} · 非商业测试数据`,
    categoryCode: categoryFor(item),
    coverUrl: imageUrl(item.main_image_id),
    brand,
    model: firstValue(item.model_number),
    productType: firstValue(item.product_type),
    description: description.slice(0, 1200),
    source: {
      dataset: "Amazon Berkeley Objects",
      domain: item.domain_name,
      marketplace: item.marketplace,
      licenseBundle: "CC BY 4.0",
      registryNotice: "AWS Registry currently lists CC BY-NC 4.0",
      commercialAllowed: false,
      testOnly: true,
      url: "https://registry.opendata.aws/amazon-berkeley-objects/",
    },
  };
}

async function download(url, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  const head = await fetch(url, { method: "HEAD" });
  if (!head.ok) throw new Error(`HEAD failed: ${head.status} ${url}`);
  const size = Number.parseInt(head.headers.get("content-length") ?? "0", 10);
  if (existsSync(destination) && statSync(destination).size === size) return;

  const chunkSize = 512 * 1024;
  const ranges = [];
  for (let start = 0; start < size; start += chunkSize) {
    ranges.push([start, Math.min(start + chunkSize - 1, size - 1)]);
  }
  const chunks = await Promise.all(
    ranges.map(async ([start, end]) => {
      const response = await fetch(url, {
        headers: { range: `bytes=${start}-${end}` },
      });
      if (response.status !== 206) {
        throw new Error(`Range download failed: ${response.status} ${url}`);
      }
      return Buffer.from(await response.arrayBuffer());
    })
  );
  const content = Buffer.concat(chunks);
  if (content.length !== size) throw new Error(`Incomplete download: ${url}`);
  await writeFile(destination, content);
}

async function loadShard(cacheDir, shard) {
  const filename = `listings_${shard}.json.gz`;
  const path = resolve(cacheDir, filename);
  await download(`${SOURCE_ROOT}/listings/metadata/${filename}`, path);
  const text = gunzipSync(await readFile(path), { finishFlush: 2 }).toString("utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function main() {
  const limit = Number.parseInt(readArg("limit", "5000"), 10);
  const output = resolve(readArg("output", DEFAULT_OUTPUT));
  const cacheDir = resolve(readArg("cache", ".codex-temp/abo/source"));
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid limit");

  const products = [];
  for (const shard of "0123456789abcdef") {
    const rows = await loadShard(cacheDir, shard);
    for (const row of rows) {
      const product = compactItem(row);
      if (product) products.push(product);
      if (products.length >= limit) break;
    }
    console.log(`Prepared ${products.length}/${limit} records`);
    if (products.length >= limit) break;
  }

  mkdirSync(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${products.map((product) => JSON.stringify(product)).join("\n")}\n`,
    "utf8"
  );
  console.log(`Wrote ${products.length} test products to ${output}`);
}

await main();
