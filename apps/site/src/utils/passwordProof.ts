export const AUTH_VERSION = "client-pbkdf2-sha256-v1";

const bytesToHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export async function createPasswordProof(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const proof = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 120_000,
      salt: encoder.encode(`angkor-emenu:${AUTH_VERSION}:${normalizedEmail}`),
    },
    key,
    256,
  );
  return bytesToHex(proof);
}
