/** Minimal RFC 6238 TOTP verification for server-side MFA factors. */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(value: string): Uint8Array | null {
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  if (normalized.length < 16 || !/^[A-Z2-7]+$/.test(normalized)) return null;
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) return null;
    buffer = (buffer << 5) | index;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes.length >= 10 ? Uint8Array.from(bytes) : null;
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, Math.floor(counter / 0x1_0000_0000));
  view.setUint32(4, counter >>> 0);
  return bytes;
}

async function hotp(secret: Uint8Array, counter: number, digits: number): Promise<string> {
  const secretBuffer = Uint8Array.from(secret).buffer as ArrayBuffer;
  const counterBuffer = counterBytes(counter).buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey('raw', secretBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBuffer));
  const offset = signature[signature.length - 1] & 0x0f;
  const code = ((signature[offset] & 0x7f) << 24) | (signature[offset + 1] << 16) | (signature[offset + 2] << 8) | signature[offset + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

function equalCode(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyTotp(secretBase32: string, code: string, now = Date.now(), allowedDriftSteps = 1): Promise<boolean> {
  if (!/^\d{6}$/.test(code) || !Number.isSafeInteger(now) || !Number.isInteger(allowedDriftSteps) || allowedDriftSteps < 0 || allowedDriftSteps > 2) return false;
  const secret = decodeBase32(secretBase32);
  if (!secret) return false;
  const currentCounter = Math.floor(now / 30_000);
  for (let offset = -allowedDriftSteps; offset <= allowedDriftSteps; offset += 1) {
    if (equalCode(await hotp(secret, currentCounter + offset, 6), code)) return true;
  }
  return false;
}
