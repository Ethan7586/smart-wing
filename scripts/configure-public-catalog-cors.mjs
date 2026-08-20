import OSS from 'ali-oss';

const PUBLIC_ORIGINS = ['https://hbbtzn.com', 'https://www.hbbtzn.com'];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createClient(bucket) {
  return new OSS({
    region: process.env.ALIYUN_OSS_REGION?.trim() || 'oss-cn-beijing',
    bucket,
    accessKeyId: required('ALIYUN_OSS_ACCESS_KEY_ID'),
    accessKeySecret: required('ALIYUN_OSS_ACCESS_KEY_SECRET'),
    stsToken: process.env.ALIYUN_OSS_STS_TOKEN?.trim() || undefined,
    secure: true,
    authorizationV4: true,
  });
}

function originsOf(rule) {
  return Array.isArray(rule.allowedOrigin) ? rule.allowedOrigin : [rule.allowedOrigin];
}

function allowsAllPublicOrigins(rule) {
  const origins = originsOf(rule);
  const methods = Array.isArray(rule.allowedMethod) ? rule.allowedMethod : [rule.allowedMethod];
  return methods.includes('GET') && PUBLIC_ORIGINS.every((origin) => origins.includes('*') || origins.includes(origin));
}

async function main() {
  const bucket = process.env.ALIYUN_OSS_BUCKET?.trim() || 'btshangcheng';
  const oss = createClient(bucket);
  const existing = (await oss.getBucketCORS(bucket)).rules ?? [];
  if (existing.some(allowsAllPublicOrigins)) {
    console.log('Public catalog CORS is already configured.');
    return;
  }
  if (existing.length >= 10) {
    throw new Error('OSS bucket has reached its ten-rule CORS limit; refusing to replace existing rules.');
  }
  await oss.putBucketCORS(bucket, [
    ...existing,
    {
      allowedOrigin: PUBLIC_ORIGINS,
      allowedMethod: ['GET', 'HEAD'],
      allowedHeader: ['Origin', 'Accept'],
      exposeHeader: ['ETag', 'Cache-Control'],
      maxAgeSeconds: '86400',
    },
  ]);
  console.log('Public catalog CORS configured without changing existing rules.');
}

await main();
