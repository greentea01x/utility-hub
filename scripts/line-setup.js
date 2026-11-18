import { mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const menuItems = [
  ['bills', 'ดูบิลเดือนนี้', 'แถวบน · ซ้าย'],
  ['history', 'ประวัติชำระเงิน', 'แถวบน · กลาง'],
  ['receipts', 'ใบเสร็จรับเงิน', 'แถวบน · ขวา'],
  ['room', 'ข้อมูลห้องพัก', 'แถวล่าง · ซ้าย'],
  ['announcements', 'ข่าวสารคอนโด', 'แถวล่าง · กลาง'],
  ['contact', 'ติดต่อนิติบุคคล', 'แถวล่าง · ขวา'],
];

const settings = [
  ['PUBLIC_BASE_URL', true],
  ['LIFF_ID', true],
  ['LINE_LOGIN_CHANNEL_ID', true],
  ['LINE_CHANNEL_SECRET', true],
  // The current resident pages do not send messages. This is needed later for
  // Messaging API calls such as creating/linking a rich menu, not for LIFF login.
  ['LINE_CHANNEL_ACCESS_TOKEN', false],
];

function configured(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function publicOrigin(value) {
  if (!configured(value)) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      !host.includes('.') ||
      isIP(host)
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildManifest(env = process.env) {
  const origin = publicOrigin(env.PUBLIC_BASE_URL);
  const liffId = /^[0-9]{6,}-[A-Za-z0-9_-]+$/.test(env.LIFF_ID?.trim() ?? '')
    ? env.LIFF_ID.trim()
    : null;
  const channelIdValid = /^[0-9]{6,}$/.test(env.LINE_LOGIN_CHANNEL_ID?.trim() ?? '');
  const configuration = Object.fromEntries(settings.map(([key, required]) => {
    let status = configured(env[key]) ? 'configured' : 'missing';
    if (status === 'configured' && (
      (key === 'PUBLIC_BASE_URL' && !origin) ||
      (key === 'LIFF_ID' && !liffId) ||
      (key === 'LINE_LOGIN_CHANNEL_ID' && !channelIdValid)
    )) status = 'invalid';
    return [key, { status, required }];
  }));
  const missing = settings
    .filter(([key, required]) => required && configuration[key].status === 'missing')
    .map(([key]) => key);
  const invalid = settings
    .filter(([key]) => configuration[key].status === 'invalid')
    .map(([key]) => key);

  return {
    mode: 'local-dry-run',
    configuration,
    missing,
    invalid,
    configurationComplete: missing.length === 0 && invalid.length === 0,
    connectionVerified: false,
    published: false,
    defaultRichMenuActivated: false,
    endpoints: {
      resident: origin ? `${origin}/resident/` : null,
      webhook: origin ? `${origin}/line/webhook` : null,
    },
    liffSettings: {
      size: 'Full',
      scopes: ['openid'],
      endpointUrl: origin ? `${origin}/resident/` : null,
      channelType: 'LINE Login',
      sameProviderAsMessagingApi: true,
    },
    richMenuLinks: menuItems.map(([page, label, position]) => ({
      page,
      label,
      position,
      actionType: 'uri',
      uri: liffId ? `https://liff.line.me/${liffId}/?page=${page}` : null,
      uriTemplate: `https://liff.line.me/{LIFF_ID}/?page=${page}`,
    })),
    notes: [
      'This manifest is a setup checklist, not a LINE rich-menu API request body.',
      'No network requests, LINE changes, message sending, or activation are performed.',
      'Secret values are never included. Configured means present, not validated with LINE.',
      'Choose six tappable bounds against the final menu image; bounds are not guessed.',
      'Read the page query parameter after liff.init() resolves; preserve liff.* parameters.',
      'The /resident-preview/ pages remain demo-only; use /resident/ for the connected app.',
    ],
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const allowed = new Set(['--help', '--dry-run', '--check', '--no-write']);
  if ([...args].some((arg) => !allowed.has(arg))) {
    console.error('Unknown option. Use --help.');
    process.exitCode = 2;
    return;
  }
  if (args.has('--help')) {
    console.log('Usage: node --env-file-if-exists=.env scripts/line-setup.js [--dry-run] [--check] [--no-write]');
    console.log('Local only. --check exits 1 if required settings are missing or invalid. --no-write skips output files.');
    return;
  }

  const manifest = buildManifest();
  console.log('LINE setup · local dry run (no network / no changes to LINE)');
  for (const [key, value] of Object.entries(manifest.configuration)) {
    console.log(`${key}: ${value.status}${value.required ? '' : ' (optional for resident login; needed for Messaging API operations)'}`);
  }
  if (manifest.invalid.includes('PUBLIC_BASE_URL')) {
    console.log('PUBLIC_BASE_URL must be a public HTTPS origin without a path, query, credentials, or IP address.');
  }
  if (manifest.invalid.includes('LIFF_ID')) console.log('LIFF_ID must have the form 1234567890-AbcdEfgh.');
  if (manifest.invalid.includes('LINE_LOGIN_CHANNEL_ID')) console.log('LINE_LOGIN_CHANNEL_ID must contain digits only.');
  console.log(`Resident endpoint: ${manifest.endpoints.resident ?? 'waiting for PUBLIC_BASE_URL'}`);
  console.log(`Webhook endpoint: ${manifest.endpoints.webhook ?? 'waiting for PUBLIC_BASE_URL'}`);
  for (const menu of manifest.richMenuLinks) console.log(`${menu.label}: ${menu.uri ?? menu.uriTemplate}`);

  if (!args.has('--no-write')) {
    const outputDir = new URL('../output/line-setup/', import.meta.url);
    await mkdir(outputDir, { recursive: true });
    await writeFile(new URL('line-setup.json', outputDir), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await writeFile(new URL('rich-menu-links.json', outputDir), `${JSON.stringify(manifest.richMenuLinks, null, 2)}\n`, { mode: 0o600 });
    console.log('Saved output/line-setup/line-setup.json and rich-menu-links.json (no secrets).');
  }
  console.log('Configuration presence is not proof of connection. Complete HTTPS, LINE Console, and phone testing before activation.');
  if (args.has('--check') && !manifest.configurationComplete) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    console.error('Could not complete the local preflight. Check output directory permissions and retry.');
    process.exitCode = 2;
  });
}
