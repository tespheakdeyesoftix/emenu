import type { Env } from "./index";

function isLocalHost(host: string) {
  if (host === "localhost" || host === "[::1]") return true;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const [first, second] = host.split(".").map(Number);
  return first === 127 || first === 10 ||
    (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export function webhookDestination(env: Pick<Env, "WEBHOOK_ALLOW_LOCAL_HTTP">, value: unknown) {
  const allowLocalHttp = env.WEBHOOK_ALLOW_LOCAL_HTTP === "true";
  const invalidUrl = allowLocalHttp
    ? "Use a public HTTPS hostname or an HTTP URL on localhost or a private IPv4 address. Remove URL credentials and fragments."
    : "Use a public HTTPS hostname without URL credentials, a custom port, or a fragment.";
  if (typeof value !== "string" || value.length > 2048)
    throw new Error(invalidUrl);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(invalidUrl);
  }
  const host = url.hostname;
  if (url.username || url.password || url.href.includes("#")) throw new Error(invalidUrl);
  const localHttp = allowLocalHttp && url.protocol === "http:" && isLocalHost(host);
  if (!localHttp && (url.protocol !== "https:" || url.port ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(host) ||
    /\.(localhost|local|internal|test|invalid|onion|home|lan|arpa)$/.test(host)))
    throw new Error(invalidUrl);
  return { url: url.href, host, localHttp };
}

function publicAddress(address: string, type: number) {
  if (type === 1) {
    const parts = address.split(".");
    if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
    const [a, b, c] = parts.map(Number);
    return a > 0 && a < 224 && ![10, 127].includes(a) &&
      !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) &&
      !(a === 172 && b >= 16 && b <= 31) && !(a === 198 && [18, 19].includes(b)) &&
      !(a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c)) || (b === 88 && c === 99))) &&
      !(a === 198 && b === 51 && c === 100) && !(a === 203 && b === 0 && c === 113);
  }
  if (!/^[\da-f:.]+$/i.test(address)) return false;
  try {
    const [first, second] = new URL(`https://[${address}]`).hostname.slice(1, -1).split(":");
    const prefix = Number.parseInt(first, 16);
    const next = second ? Number.parseInt(second, 16) : 0;
    return prefix >= 0x2000 && prefix < 0x4000 && prefix !== 0x2002 && prefix !== 0x3fff &&
      !(prefix === 0x2001 && (next < 0x0200 || next === 0x0db8));
  } catch {
    return false;
  }
}

export async function checkWebhookDns(host: string, signal: AbortSignal) {
  const records = await Promise.all([1, 28].map(async type => {
    const url = new URL("https://cloudflare-dns.com/dns-query");
    url.search = new URLSearchParams({ name: host, type: String(type) }).toString();
    const response = await fetch(url, { headers: { accept: "application/dns-json" }, redirect: "manual", signal });
    if (!response.ok) throw new Error("DNS request failed.");
    const data = await response.json<{ Status: number; TC?: boolean; Answer?: { type: number; data: string }[] }>();
    if (data.TC || (data.Status !== 0 && data.Status !== 3)) throw new Error("DNS response was incomplete.");
    return (data.Answer ?? []).filter(answer => answer.type === 1 || answer.type === 28);
  }));
  const addresses = records.flat();
  if (!addresses.length) throw new Error("The destination has no public DNS address.");
  return addresses.every(({ data, type }) => typeof data === "string" && publicAddress(data, type));
}

const encoder = new TextEncoder();

async function headerKey(env: Env, businessId: string, branchId: string) {
  if (!env.AUTH_PEPPER || env.AUTH_PEPPER.length < 32)
    throw new Error("Webhook header encryption is unavailable.");
  const secret = await crypto.subtle.importKey("raw", encoder.encode(env.AUTH_PEPPER), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({
    name: "HKDF", hash: "SHA-256", salt: encoder.encode("emenu:webhook-headers:v1"),
    info: encoder.encode(JSON.stringify([businessId, branchId])),
  }, secret, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptWebhookHeaders(
  env: Env, businessId: string, branchId: string, headers: Record<string, string>,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await headerKey(env, businessId, branchId);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(headers)));
  const bytes = new Uint8Array(encrypted);
  let encoded = String.fromCharCode(...iv);
  for (let offset = 0; offset < bytes.length; offset += 8192)
    encoded += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(encoded);
}

export async function decryptWebhookHeaders(env: Env, businessId: string, branchId: string, value: string) {
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
  const key = await headerKey(env, businessId, branchId);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  return JSON.parse(new TextDecoder().decode(clear)) as Record<string, string>;
}
