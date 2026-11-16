import {
  bodyOf,
  Command,
  conflict,
  invalid,
  missing,
  pageOf,
  requireManager,
  respond,
  sql,
  string,
  type PosContext,
} from "./posApiCore";

export function staffUsername(value: unknown) {
  const username = string(value, "username", 40);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$/.test(username)) {
    invalid(
      "Use 2–40 letters, digits, dots, hyphens or underscores, starting with a letter or digit",
    );
  }
  return username.toLowerCase();
}

const eligibleStaff = `m.business_id=? AND m.role<>'owner' AND (
  m.role='manager' OR EXISTS (
    SELECT 1 FROM pos_profile_grants g
    WHERE g.business_id=m.business_id AND g.profile_id=? AND g.user_id=m.user_id
  )
)`;

export async function resolveStaffUsername(
  context: PosContext,
  request: Request,
) {
  requireManager(context.identity.role);
  const { username } = await bodyOf(request);
  const member = await sql(
    context.db,
    `SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE ${eligibleStaff} AND m.pos_username=?`,
    context.identity.business_id,
    context.profile.id,
    staffUsername(username),
  ).first<{ email: string }>();
  if (!member) missing("Staff username");
  return respond(member);
}

export async function listStaffUsernames(context: PosContext, url: URL) {
  requireManager(context.identity.role);
  return respond(
    await pageOf(
      context.db,
      url,
      "staff",
      `SELECT m.user_id,u.display_name AS name,m.role,m.pos_username AS username
    FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE ${eligibleStaff} ORDER BY u.display_name COLLATE NOCASE,m.user_id`,
      [context.identity.business_id, context.profile.id],
    ),
  );
}

export async function setStaffUsername(
  context: PosContext,
  request: Request,
  userId: string,
) {
  requireManager(context.identity.role);
  const command = await Command.read(request, context);
  if (command instanceof Response) return command;
  const username =
    command.body.username === null
      ? null
      : staffUsername(command.body.username);
  const { db, identity, profile } = context;
  const matching = `FROM memberships m WHERE ${eligibleStaff} AND m.user_id=?`;
  const params = [identity.business_id, profile.id, userId];
  if (!(await sql(db, `SELECT 1 ${matching}`, ...params).first()))
    missing("Staff member");
  try {
    return await command.commit(
      200,
      {
        query: `EXISTS (SELECT 1 ${matching})`,
        params,
        manager: true,
        allowReadOnly: true,
        allowStoreAuthority: true,
      },
      [
        sql(
          db,
          "UPDATE memberships SET pos_username=? WHERE business_id=? AND user_id=?",
          username,
          identity.business_id,
          userId,
        ),
      ],
      {
        query: `SELECT json_object('user_id',m.user_id,'username',m.pos_username) ${matching}`,
        params,
      },
    );
  } catch (error) {
    const replay = await command.replay();
    if (replay) return replay;
    if (
      error instanceof Error &&
      error.message.includes(
        "UNIQUE constraint failed: memberships.business_id, memberships.pos_username",
      )
    ) {
      conflict(
        "That username is already in use in this business",
        "POS_USERNAME_TAKEN",
      );
    }
    throw error;
  }
}
