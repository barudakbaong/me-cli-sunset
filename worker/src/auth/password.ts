import { utf8Encode } from "../crypto/encoding";

const PBKDF2_ITERS = 200_000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", utf8Encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const dk = await pbkdf2(password, salt);
  return `pbkdf2_sha256$${PBKDF2_ITERS}$${bytesToHex(salt)}$${bytesToHex(dk)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algo, itersStr, saltHex, hashHex] = encoded.split("$");
    if (algo !== "pbkdf2_sha256") return false;
    const iters = Number.parseInt(itersStr, 10);
    if (iters !== PBKDF2_ITERS) return false;
    const salt = hexToBytes(saltHex);
    const expected = hexToBytes(hashHex);
    const key = await crypto.subtle.importKey("raw", utf8Encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: iters },
      key,
      256,
    );
    return timingSafeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}