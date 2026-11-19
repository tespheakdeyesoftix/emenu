import { userPermissionKeys, userPermissions } from "../../../shared/userPermissions";
import { bodyOf, choice, errorResponse, invalid, missing, newId, respond, sql, string, conflict } from "./posApiCore";
import { staffUsername } from "./posApiStaff";
import { planLimitError } from "./subscriptionPlans";

async function userCapacity(db: D1Database, businessId: string) {
  const result = await sql(db, `SELECT
    (SELECT COUNT(*) FROM memberships WHERE business_id=?1) AS current,
    (SELECT p.max_users FROM business_subscriptions s JOIN subscription_plans p
      ON p.id=s.plan_id WHERE s.business_id=?1) AS quota`, businessId)
    .first<{ current: number; quota: number | null }>();
  return { current: result!.current, limit: result!.quota };
}

type Auth = { userId: string; businessId: string; role: string; sessionType: string };
type Credential = (proof: string) => Promise<{ hash: string; salt: string }>;
const members = `FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.business_id=?`;
const fields = `u.id,u.display_name AS name,u.email,m.role,m.pos_username AS username,u.permissions,
  (SELECT COUNT(*) FROM memberships other WHERE other.user_id=u.id) AS memberships,
  (SELECT json_group_array(g.profile_id) FROM pos_profile_grants g
    WHERE g.user_id=u.id AND g.business_id=m.business_id) AS profile_ids`;

export async function adminUsers(request: Request, url: URL, db: D1Database, auth: Auth, credential: Credential) {
  if (auth.role !== "owner" || auth.sessionType !== "customer")
    return respond({ error: "Only the business owner can manage users." }, 403);
  try {
    const suffix = url.pathname.slice("/api/admin/users".length);
    if (request.method === "GET" && suffix === "/options") {
      const profiles = await sql(db, `SELECT p.id,p.name,b.name AS branch FROM pos_profiles p
        JOIN branches b ON b.id=p.branch_id WHERE p.business_id=? ORDER BY b.name,p.name,p.id`, auth.businessId).all();
      return respond({ profiles: profiles.results });
    }
    if (request.method === "GET" && !suffix) {
      const { results } = await sql(db, `SELECT ${fields} ${members}
        ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,u.display_name COLLATE NOCASE,u.id`, auth.businessId).all<{
        permissions: string; role: string; profile_ids: string;
      } & Record<string, unknown>>();
      return respond({ capacity: await userCapacity(db, auth.businessId), users: results.map(row => ({
        ...row, permissions: userPermissions(row.permissions, row.role),
        profile_ids: JSON.parse(row.profile_ids),
      })) });
    }
    const match = suffix.match(/^\/([a-zA-Z0-9_-]{1,80})$/);
    const id = match?.[1];
    if ((suffix && !id) || (!id && request.method !== "POST") || (id && !["PATCH","DELETE"].includes(request.method)))
      return respond({ error: "Method not allowed" }, 405);
    const existing = id ? await sql(db, `SELECT u.id,u.email,m.role,
      (SELECT COUNT(*) FROM memberships other WHERE other.user_id=u.id) AS memberships
      ${members} AND u.id=?`, auth.businessId, id).first<{ id: string; email: string; role: string; memberships: number }>() : null;
    if (id && !existing) missing("Business user");
    if (existing?.role === "owner" || id === auth.userId)
      return respond({ error: "Use your account settings to edit the owner account." }, 403);
    if (request.method === "DELETE") {
      const removable = `EXISTS (SELECT 1 FROM memberships target JOIN memberships actor
        ON actor.business_id=target.business_id
        WHERE target.business_id=? AND target.user_id=? AND target.role<>'owner'
          AND actor.user_id=? AND actor.role='owner')`;
      const deletes = ["pos_profile_grants","pos_sessions","pos_device_credentials","sessions","memberships"]
        .map(table => sql(db, `DELETE FROM ${table} WHERE business_id=? AND user_id=? AND ${removable}`,
          auth.businessId,id,auth.businessId,id,auth.userId));
      const results = await db.batch(deletes);
      if (!results.at(-1)?.meta.changes) conflict("The user changed. Refresh and retry.");
      return respond({ ok: true });
    }
    if (existing && existing.memberships > 1)
      return respond({ error: "This account belongs to multiple businesses. Its account and permissions need to be managed in Super Control." }, 409);
    if (!existing) {
      const capacity = await userCapacity(db, auth.businessId);
      if (capacity.limit !== null && capacity.current >= capacity.limit)
        return respond(planLimitError("PLAN_USER_LIMIT"), 409);
    }
    const body = await bodyOf(request);
    const name = string(body.name, "name", 120);
    const email = existing?.email ?? string(body.email, "email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("Enter a valid email address.");
    const role = choice(body.role, "role", ["manager", "editor"] as const);
    const username = body.username ? staffUsername(body.username) : null;
    const permissions = body.permissions;
    if (!permissions || typeof permissions !== "object" || Array.isArray(permissions) ||
        Object.keys(permissions).some(key => !userPermissionKeys.includes(key as typeof userPermissionKeys[number])) ||
        userPermissionKeys.some(key => typeof (permissions as Record<string, unknown>)[key] !== "boolean"))
      invalid("Choose valid user permissions.");
    if (!Array.isArray(body.profile_ids) || body.profile_ids.length > 500 ||
        body.profile_ids.some(id => typeof id !== "string") || new Set(body.profile_ids).size !== body.profile_ids.length)
      invalid("Choose valid POS profiles.");
    const profiles = JSON.stringify(body.profile_ids);
    const total = await sql(db, `SELECT COUNT(*) AS total FROM pos_profiles WHERE business_id=?
      AND id IN (SELECT value FROM json_each(?))`, auth.businessId, profiles).first<number>("total");
    if (total !== body.profile_ids.length) invalid("Choose profiles from this business.");
    let password: Awaited<ReturnType<Credential>> | null = null;
    if (!existing || body.passwordProof !== undefined) {
      if (body.authVersion !== "client-pbkdf2-sha256-v1" || typeof body.passwordProof !== "string" ||
          !/^[a-f0-9]{64}$/.test(body.passwordProof)) invalid("Provide a valid password.");
      password = await credential(body.passwordProof);
    }
    const userId = id ?? newId("usr");
    const encoded = JSON.stringify(permissions);
    // The owner membership and single-business ownership are checked again in
    // the same transaction that changes the account.
    const canEdit = `EXISTS (SELECT 1 FROM memberships WHERE business_id=? AND user_id=? AND role='owner')`;
    if (!existing) {
      const [created] = await db.batch([
        sql(db, `INSERT INTO users(id,email,display_name,password_hash,password_salt,permissions)
          SELECT ?,?,?,?,?,? WHERE ${canEdit}`,
          userId, email, name, password!.hash, password!.salt, encoded, auth.businessId, auth.userId),
        sql(db, `INSERT INTO memberships(user_id,business_id,role,pos_username)
          SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=?)`, userId, auth.businessId, role, username, userId),
        sql(db, `INSERT INTO pos_profile_grants(business_id,profile_id,user_id)
          SELECT ?,value,? FROM json_each(?) WHERE EXISTS(SELECT 1 FROM memberships WHERE user_id=? AND business_id=?)`,
          auth.businessId, userId, profiles, userId, auth.businessId),
      ]);
      if (!created.meta.changes) conflict("Your access changed. Refresh and retry.");
    } else {
      const [updated] = await db.batch([
        sql(db, `UPDATE users SET display_name=?,permissions=?,
          password_hash=COALESCE(?,password_hash),password_salt=COALESCE(?,password_salt)
          WHERE id=? AND ${canEdit}
          AND (SELECT COUNT(*) FROM memberships WHERE user_id=users.id)=1
          AND EXISTS(SELECT 1 FROM memberships WHERE user_id=users.id AND business_id=? AND role<>'owner')`,
          name, encoded, password?.hash ?? null, password?.salt ?? null, userId, auth.businessId, auth.userId, auth.businessId),
        sql(db, `UPDATE memberships SET role=CASE WHEN changes()=1 THEN ? ELSE NULL END,pos_username=? WHERE business_id=? AND user_id=? AND role<>'owner'`,
          role, username, auth.businessId, userId),
        sql(db, "DELETE FROM pos_profile_grants WHERE business_id=? AND user_id=? AND profile_id NOT IN (SELECT value FROM json_each(?))", auth.businessId, userId, profiles),
        sql(db, `INSERT INTO pos_profile_grants(business_id,profile_id,user_id)
          SELECT ?,value,? FROM json_each(?) WHERE 1 ON CONFLICT DO NOTHING`, auth.businessId, userId, profiles),
        ...(password ? [
          sql(db, "DELETE FROM sessions WHERE user_id=?", userId),
          sql(db, "DELETE FROM pos_sessions WHERE user_id=?", userId),
          sql(db, "DELETE FROM pos_device_credentials WHERE user_id=?", userId),
        ] : []),
      ]);
      if (!updated.meta.changes) conflict("The user changed. Refresh and retry.");
    }
    return respond({ id: userId }, existing ? 200 : 201);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed: users.email"))
      return respond({ error: "This email is already registered. Use another email for the additional user." }, 409);
    if (String(error).includes("UNIQUE constraint failed: memberships.business_id, memberships.pos_username"))
      return respond({ error: "That POS username is already in use in this business." }, 409);
    return errorResponse(error);
  }
}
