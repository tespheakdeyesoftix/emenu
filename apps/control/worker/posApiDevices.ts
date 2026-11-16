import {
  activeDeviceSession,
  bodyOf,
  digest,
  integer,
  invalid,
  missing,
  pageOf,
  PosError,
  privileged,
  recordId,
  requirePosPlan,
  respond,
  sql,
  string,
  type PosContext,
} from "./posApiCore";
import { posPlanEnabled } from "./subscriptionPlans";

const proofWindow = 120;
export const accessLifetime = 43_200;

export function issuePosToken(lifetime: number) {
  return {
    token:
      "possession_" +
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", ""),
    expiresAt: Math.floor(Date.now() / 1000) + lifetime,
  };
}

function hex(value: unknown, field: string, bytes: number): string {
  if (
    typeof value !== "string" ||
    value.length !== bytes * 2 ||
    !/^[a-f0-9]+$/.test(value)
  )
    invalid(`Invalid ${field}`);
  return value;
}

function decodeHex(value: string) {
  return Uint8Array.from(value.match(/../g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
}

function invalidProof(): never {
  throw new PosError(
    401,
    "INVALID_DEVICE_CREDENTIAL",
    "Sign in to enroll this POS device",
  );
}

const grantRequired = `(m.role IN ('owner','manager') OR EXISTS (
  SELECT 1 FROM pos_profile_grants g
  WHERE g.business_id=p.business_id AND g.profile_id=p.id AND g.user_id=m.user_id
))`;

const activeCaller = `
  FROM pos_sessions s
  JOIN pos_profiles p ON p.business_id=s.business_id AND p.id=s.profile_id AND p.is_active=1
  JOIN branches b ON b.business_id=p.business_id AND b.id=p.branch_id AND b.is_active=1
  JOIN businesses business ON business.id=p.business_id AND business.is_active=1
  JOIN memberships m ON m.business_id=s.business_id AND m.user_id=s.user_id
  JOIN users u ON u.id=m.user_id AND u.password_salt=s.credential_version
  WHERE s.token_hash=? AND s.expires_at>unixepoch()
    AND ${activeDeviceSession} AND ${grantRequired} AND ${posPlanEnabled("p.business_id")}`;

const credentialFields =
  "id,device_id,device_name,user_id,created_at,last_used_at,revoked_at";

export async function registerDevice(context: PosContext, request: Request) {
  const body = await bodyOf(request);
  const deviceId = recordId(body.device_id, "device_id");
  const name = string(body.device_name, "device_name", 80);
  const publicKey = hex(body.public_key, "public_key", 32);
  const { db, identity, profile } = context;
  const token = identity.token_hash;
  const device = "posdev_" + crypto.randomUUID().replaceAll("-", "");
  const [registered] = await db.batch([
    sql(
      db,
      `INSERT INTO pos_device_credentials
        (id,business_id,profile_id,user_id,device_id,device_name,public_key,credential_version,created_at,last_used_at)
        SELECT ?,s.business_id,s.profile_id,s.user_id,?,?,?,s.credential_version,unixepoch(),unixepoch()
        ${activeCaller} AND s.issued_by_device=0
        ON CONFLICT (business_id,profile_id,user_id,device_id) DO UPDATE SET
          device_name=excluded.device_name, credential_version=excluded.credential_version,
          revoked_at=NULL, last_used_at=unixepoch()
        WHERE pos_device_credentials.public_key=excluded.public_key
        RETURNING ${credentialFields}`,
      device,
      deviceId,
      name,
      publicKey,
      token,
    ),
    sql(
      db,
      `UPDATE pos_sessions SET device_credential_id=(
        SELECT id FROM pos_device_credentials WHERE business_id=? AND profile_id=? AND user_id=?
          AND device_id=? AND public_key=? AND revoked_at IS NULL
      ) WHERE token_hash=? AND issued_by_device=0 AND device_credential_id IS NULL
        AND EXISTS (SELECT 1 ${activeCaller})`,
      identity.business_id,
      profile.id,
      identity.user_id,
      deviceId,
      publicKey,
      token,
      token,
    ),
  ]);
  if (!registered.results.length) {
    const caller = await sql(
      db,
      `SELECT s.issued_by_device ${activeCaller}`,
      token,
    ).first<{ issued_by_device: number }>();
    if (!caller || caller.issued_by_device) {
      throw new PosError(
        403,
        "PASSWORD_SESSION_REQUIRED",
        "Sign in with a password to enroll a POS device",
      );
    }
    throw new PosError(
      409,
      "DEVICE_KEY_CHANGED",
      "Use the enrolled key or set up a new device",
    );
  }
  return respond(registered.results[0], 201);
}

export async function renewDeviceSession(db: D1Database, request: Request) {
  const body = await bodyOf(request);
  const id = recordId(body.credential_id, "credential_id");
  const nonce = hex(body.nonce, "nonce", 32);
  const proof = hex(body.signature, "signature", 64);
  const issuedAt = integer(body.issued_at, "issued_at", 0);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - issuedAt) > proofWindow) {
    throw new PosError(
      409,
      "DEVICE_PROOF_EXPIRED",
      "Check the POS device date and time",
    );
  }
  const credential = await sql(
    db,
    `SELECT d.public_key, ${posPlanEnabled("d.business_id")} AS pos_enabled
     FROM pos_device_credentials d WHERE d.id=? AND d.revoked_at IS NULL`,
    id,
  ).first<{ public_key: string; pos_enabled: number }>();
  if (!credential) invalidProof();
  let verified = false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      decodeHex(credential.public_key),
      "Ed25519",
      false,
      ["verify"],
    );
    verified = await crypto.subtle.verify(
      "Ed25519",
      key,
      decodeHex(proof),
      new TextEncoder().encode(
        `emenu.pos.device-session.v1\n${id}\n${issuedAt}\n${nonce}`,
      ),
    );
  } catch {
    invalidProof();
  }
  if (!verified) invalidProof();
  requirePosPlan(credential.pos_enabled);
  const { token, expiresAt } = issuePosToken(accessLifetime);
  const hash = await digest(token);
  const [, , minted] = await db.batch<{ profile_id: string; user_id: string }>([
    sql(db, "DELETE FROM pos_device_proofs WHERE expires_at<?", now),
    sql(
      db,
      `INSERT INTO pos_device_proofs (credential_id,nonce,session_hash,expires_at)
        SELECT d.id,?,?,? FROM pos_device_credentials d
        JOIN pos_profiles p ON p.business_id=d.business_id AND p.id=d.profile_id AND p.is_active=1
        JOIN branches b ON b.business_id=p.business_id AND b.id=p.branch_id AND b.is_active=1
        JOIN businesses business ON business.id=p.business_id AND business.is_active=1
        JOIN memberships m ON m.business_id=d.business_id AND m.user_id=d.user_id
        JOIN users u ON u.id=m.user_id AND u.password_salt=d.credential_version
        WHERE d.id=? AND d.public_key=? AND d.revoked_at IS NULL AND ${grantRequired}
          AND ${posPlanEnabled("d.business_id")}
        ON CONFLICT (credential_id,nonce) DO NOTHING`,
      nonce,
      hash,
      issuedAt + proofWindow,
      id,
      credential.public_key,
    ),
    sql(
      db,
      `INSERT INTO pos_sessions
        (token_hash,business_id,user_id,profile_id,credential_version,expires_at,device_credential_id,issued_by_device)
        SELECT ?,d.business_id,d.user_id,d.profile_id,d.credential_version,?,d.id,1
        FROM pos_device_credentials d JOIN pos_device_proofs proof ON proof.credential_id=d.id
        WHERE d.id=? AND proof.nonce=? AND proof.session_hash=?
        RETURNING profile_id,user_id`,
      hash,
      expiresAt,
      id,
      nonce,
      hash,
    ),
    sql(
      db,
      `UPDATE pos_device_credentials SET last_used_at=unixepoch()
        WHERE id=? AND EXISTS (SELECT 1 FROM pos_sessions WHERE token_hash=?)`,
      id,
      hash,
    ),
    sql(
      db,
      "DELETE FROM pos_sessions WHERE device_credential_id=? AND expires_at<=unixepoch()",
      id,
    ),
  ]);
  if (!minted.results.length) invalidProof();
  return respond(
    {
      token,
      expires_at: new Date(expiresAt * 1000).toISOString(),
      ...minted.results[0],
    },
    201,
  );
}

export async function listDevices(context: PosContext, url: URL) {
  const { db, identity, profile } = context;
  return respond(
    await pageOf(
      db,
      url,
      "devices",
      `SELECT ${credentialFields} FROM pos_device_credentials
      WHERE business_id=? AND profile_id=? AND (?=1 OR user_id=?)
      ORDER BY created_at DESC,id DESC`,
      [
        identity.business_id,
        profile.id,
        Number(privileged(identity.role)),
        identity.user_id,
      ],
    ),
  );
}

export async function revokeDevice(context: PosContext, id: string) {
  const { db, identity, profile } = context;
  const revoked = await sql(
    db,
    `UPDATE pos_device_credentials AS target SET revoked_at=COALESCE(revoked_at,unixepoch())
      WHERE id=? AND business_id=? AND profile_id=?
        AND EXISTS (SELECT 1 ${activeCaller}
          AND (s.user_id=target.user_id OR m.role IN ('owner','manager')))
      RETURNING id`,
    id,
    identity.business_id,
    profile.id,
    identity.token_hash,
  ).first<{ id: string }>();
  if (!revoked) missing("Device credential");
  return respond({ ok: true });
}
