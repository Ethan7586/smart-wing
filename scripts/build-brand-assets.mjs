import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brandSource = join(repoRoot, 'packages', 'design-system', 'src', 'brand');
const markSource = join(brandSource, 'brand-mark.svg');
const lockupSource = join(brandSource, 'brand-lockup-horizontal.svg');

const appTargets = [
  {
    directory: join(repoRoot, 'apps', 'admin-web', 'public', 'brand'),
    startUrl: '/',
    scope: '/',
    name: '智慧翼运营管理后台',
  },
  {
    directory: join(repoRoot, 'apps', 'auth-web', 'public', 'brand'),
    startUrl: '/login/',
    scope: '/login/',
    name: '智慧翼统一登录',
  },
];

const shareCard = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="95" y1="35" x2="1110" y2="620" gradientUnits="userSpaceOnUse">
      <stop stop-color="#07182F" />
      <stop offset="0.55" stop-color="#143A8F" />
      <stop offset="1" stop-color="#1F5EFF" />
    </linearGradient>
    <linearGradient id="mark" x1="102" y1="120" x2="298" y2="338" gradientUnits="userSpaceOnUse">
      <stop stop-color="#4F89FF" />
      <stop offset="0.55" stop-color="#1F5EFF" />
      <stop offset="1" stop-color="#143A8F" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="0" fill="url(#bg)" />
  <circle cx="1050" cy="-25" r="260" fill="#FFFFFF" opacity="0.05" />
  <circle cx="1110" cy="570" r="310" fill="#6EA0FF" opacity="0.08" />
  <path d="M814 75C930 124 1036 210 1127 347" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" />
  <rect x="104" y="116" width="196" height="196" rx="52" fill="url(#mark)" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="2" />
  <path d="M127 162H155L179 224L195 185L211 224L235 162H263L226 255H203L195 236L187 255H164L127 162Z" fill="#FFFFFF" />
  <text x="104" y="408" fill="#FFFFFF" font-family="Microsoft YaHei, PingFang SC, Noto Sans SC, Arial, sans-serif" font-size="68" font-weight="700">智慧翼</text>
  <text x="107" y="465" fill="#BFD3FF" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="4">SMART WING</text>
  <text x="104" y="538" fill="#FFFFFF" font-family="Microsoft YaHei, PingFang SC, Noto Sans SC, Arial, sans-serif" font-size="28" font-weight="500">企业福利商城 · 让每一份福利更有温度</text>
  <rect x="716" y="183" width="350" height="190" rx="28" fill="#FFFFFF" opacity="0.08" stroke="#FFFFFF" stroke-opacity="0.16" />
  <text x="762" y="242" fill="#BFD3FF" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2.5">ENTERPRISE BENEFITS</text>
  <text x="762" y="299" fill="#FFFFFF" font-family="Microsoft YaHei, PingFang SC, Noto Sans SC, Arial, sans-serif" font-size="31" font-weight="700">员工福利 · 企业治理</text>
  <text x="762" y="341" fill="#DCE8FF" font-family="Microsoft YaHei, PingFang SC, Noto Sans SC, Arial, sans-serif" font-size="19">统一身份 · 权限 · 商城 · 运营</text>
</svg>`);

async function renderIcon(size, destination) {
  await sharp(markSource, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(destination);
}

async function writeAppAssets(target) {
  await mkdir(target.directory, { recursive: true });
  await Promise.all([
    copyFile(markSource, join(target.directory, 'brand-mark.svg')),
    copyFile(markSource, join(target.directory, 'favicon.svg')),
    copyFile(lockupSource, join(target.directory, 'brand-lockup-horizontal.svg')),
    renderIcon(180, join(target.directory, 'apple-touch-icon.png')),
    renderIcon(192, join(target.directory, 'icon-192.png')),
    renderIcon(512, join(target.directory, 'icon-512.png')),
    sharp(shareCard).png({ compressionLevel: 9 }).toFile(join(target.directory, 'share-wechat.png')),
  ]);

  const manifest = {
    name: target.name,
    short_name: '智慧翼',
    description: '智慧翼企业福利商城',
    lang: 'zh-CN',
    start_url: target.startUrl,
    scope: target.scope,
    display: 'standalone',
    background_color: '#F5F7FA',
    theme_color: '#143A8F',
    icons: [
      { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  await writeFile(join(target.directory, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

await Promise.all(appTargets.map(writeAppAssets));

const storefrontApp = join(repoRoot, 'apps', 'storefront-web', 'app');
await copyFile(markSource, join(storefrontApp, 'icon.svg'));
await renderIcon(180, join(storefrontApp, 'apple-icon.png'));
await renderIcon(192, join(storefrontApp, 'icon1.png'));
await renderIcon(512, join(storefrontApp, 'icon2.png'));
await sharp(shareCard).png({ compressionLevel: 9 }).toFile(join(storefrontApp, 'opengraph-image.png'));

const markBytes = await readFile(markSource);
console.log(`Smart Wing brand assets generated from ${markBytes.length} byte SVG master.`);
