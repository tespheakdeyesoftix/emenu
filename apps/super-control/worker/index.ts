import { createRemoteJWKSet, jwtVerify } from "jose";
import type { SuperAdminService } from "../../control/worker/index";

interface Env {
  ASSETS: Fetcher;
  CONTROL_ADMIN: Service<SuperAdminService>;
  SUPER_ADMIN_EMAIL: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}

type AccessContext = ExecutionContext & {
  access?: {
    aud: string;
    getIdentity(): Promise<{ email?: string } | null>;
  };
};

type RpcResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; code?: string };

const jwksSets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const responseJson = (
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });

function accessDomain(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");
  return trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

async function authenticatedEmail(
  request: Request,
  env: Env,
  ctx: AccessContext,
) {
  const expectedEmail = env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const identity = await ctx.access?.getIdentity();
    if (identity?.email?.toLowerCase() === expectedEmail) return expectedEmail;
  }

  if (
    !env.ACCESS_TEAM_DOMAIN ||
    !env.ACCESS_AUD ||
    env.ACCESS_TEAM_DOMAIN.startsWith("REPLACE_") ||
    env.ACCESS_AUD.startsWith("REPLACE_")
  )
    throw new Error("Cloudflare Access is not configured");

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  const issuer = accessDomain(env.ACCESS_TEAM_DOMAIN);
  let jwks = jwksSets.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksSets.set(issuer, jwks);
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: env.ACCESS_AUD,
  });
  return String(payload.email || "")
    .trim()
    .toLowerCase() === expectedEmail
    ? expectedEmail
    : null;
}

async function bodyJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return null;
  return (await request.json()) as Record<string, unknown>;
}

function fromRpc(result: RpcResult, successStatus = 200) {
  return result.ok
    ? responseJson(result.data, successStatus)
    : responseJson(
        {
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
        },
        result.status,
      );
}

async function handleApi(request: Request, env: Env, actorEmail: string) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (request.method === "GET" && path === "/api/super/session")
    return responseJson({ email: actorEmail });

  if (request.method === "GET" && path === "/api/super/dashboard")
    return fromRpc(
      (await env.CONTROL_ADMIN.dashboard(actorEmail)) as RpcResult,
    );

  const planMatch = path.match(/^\/api\/super\/subscription-plans(?:\/([a-zA-Z0-9_-]+))?$/);
  if (planMatch) {
    const planId = planMatch[1];
    if (!planId && request.method === "GET")
      return fromRpc(await env.CONTROL_ADMIN.listSubscriptionPlans(actorEmail));
    if (planId && request.method === "DELETE")
      return fromRpc(await env.CONTROL_ADMIN.removeSubscriptionPlan(actorEmail, planId));
    if ((!planId && request.method === "POST") || (planId && request.method === "PUT")) {
      const body = await bodyJson(request).catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return responseJson({ error: "Expected a JSON object" }, 400);
      return fromRpc(await env.CONTROL_ADMIN.saveSubscriptionPlan(actorEmail, planId ?? null, body), planId ? 200 : 201);
    }
  }

  const assignPlanMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/subscription-plan$/);
  if (assignPlanMatch && request.method === "PUT") {
    const body = await bodyJson(request).catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return responseJson({ error: "Expected a JSON object" }, 400);
    return fromRpc(await env.CONTROL_ADMIN.assignSubscriptionPlan(actorEmail, assignPlanMatch[1], body));
  }

  if (request.method === "GET" && path === "/api/super/businesses") {
    return fromRpc(
      (await env.CONTROL_ADMIN.listBusinesses(actorEmail, {
        q: url.searchParams.get("q") || "",
        status: url.searchParams.get("status") || "all",
        subscriptionStatus: url.searchParams.get("subscriptionStatus") || "all",
        page: Number(url.searchParams.get("page") || 1),
        pageSize: Number(url.searchParams.get("pageSize") || 25),
      })) as RpcResult,
    );
  }

  if (request.method === "POST" && path === "/api/super/businesses") {
    const body = await bodyJson(request);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.createBusiness(actorEmail, body)) as RpcResult,
      201,
    );
  }

  const posIntegrationMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/pos-integration$/,
  );
  if (posIntegrationMatch) {
    if (!["GET", "PUT", "DELETE"].includes(request.method))
      return responseJson({ error: "Method not allowed" }, 405, {
        allow: "GET, PUT, DELETE",
      });
    let body: Record<string, unknown> | null = {};
    if (request.method === "PUT") {
      try {
        body = await bodyJson(request);
      } catch {
        return responseJson({ error: "Expected valid JSON" }, 400);
      }
    }
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.manageBusinessPosIntegration(
        actorEmail,
        posIntegrationMatch[1],
        request.method as "GET" | "PUT" | "DELETE",
        body,
      )) as RpcResult,
    );
  }

  const bookingMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/booking-(feature|settings)$/);
  if (bookingMatch) {
    const action = bookingMatch[2] === "feature" ? "feature" : "settings";
    const method = request.method;
    if (method !== "GET" && method !== "PUT")
      return responseJson({ error: "Method not allowed" }, 405, { allow: "GET, PUT" });
    const body = method === "GET" ? {} : await bodyJson(request).catch(() => null);
    if (!body || Array.isArray(body)) return responseJson({ error: "Expected a valid JSON body" }, 400);
    return fromRpc(await env.CONTROL_ADMIN.manageBooking(
      actorEmail, bookingMatch[1], action, method, body,
    ) as RpcResult);
  }

  const resetMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/reset-data\/(backup|delete)$/);
  if (resetMatch && request.method === "POST") {
    const body = await bodyJson(request).catch(() => null);
    if (!body || Array.isArray(body)) return responseJson({ error: "Expected a valid JSON body" }, 400);
    return fromRpc(await env.CONTROL_ADMIN.resetData(actorEmail, resetMatch[1], resetMatch[2] === "backup" ? "backup" : "delete", body));
  }

  const detailMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_]+)$/);
  if (request.method === "GET" && detailMatch)
    return fromRpc(
      (await env.CONTROL_ADMIN.businessDetail(
        actorEmail,
        detailMatch[1],
      )) as RpcResult,
    );

  const clonePreviewMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_]+)\/clone\/preview$/,
  );
  if (request.method === "POST" && clonePreviewMatch) {
    const body = await bodyJson(request);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.previewBusinessClone(
        actorEmail,
        clonePreviewMatch[1],
        body,
      )) as RpcResult,
    );
  }

  const cloneMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_]+)\/clone$/,
  );
  if (request.method === "POST" && cloneMatch) {
    const body = await bodyJson(request);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.cloneBusinessData(
        actorEmail,
        cloneMatch[1],
        body,
      )) as RpcResult,
    );
  }

  const memberMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_]+)\/members$/,
  );
  if (request.method === "POST" && memberMatch) {
    const body = await bodyJson(request);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.createBusinessMember(
        actorEmail,
        memberMatch[1],
        body,
      )) as RpcResult,
      201,
    );
  }

  const statusMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_]+)\/status$/,
  );
  if (request.method === "PATCH" && statusMatch) {
    const body = await bodyJson(request);
    if (!body || typeof body.isActive !== "boolean")
      return responseJson({ error: "isActive must be a boolean" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.setBusinessStatus(
        actorEmail,
        statusMatch[1],
        body.isActive,
      )) as RpcResult,
    );
  }

  const subscriptionMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_]+)\/subscription$/,
  );
  if (request.method === "PATCH" && subscriptionMatch) {
    const body = await bodyJson(request);
    if (
      !body ||
      !(body.expiresOn === null || typeof body.expiresOn === "string")
    )
      return responseJson({ error: "expiresOn must be a date or null" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.updateBusinessSubscription(
        actorEmail,
        subscriptionMatch[1],
        body,
      )) as RpcResult,
    );
  }

  const controlPagesMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/control-pages$/,
  );
  if (request.method === "PUT" && controlPagesMatch) {
    const body = await bodyJson(request).catch(() => null);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      await env.CONTROL_ADMIN.updateBusinessControlPages(actorEmail, controlPagesMatch[1], body),
    );
  }

  const businessWebhookHistoryMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/webhook-deliveries$/);
  if (businessWebhookHistoryMatch && request.method === "DELETE")
    return fromRpc(await env.CONTROL_ADMIN.clearWebhookHistory(actorEmail, businessWebhookHistoryMatch[1], null, null));

  const webhookMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/branches\/([a-zA-Z0-9_-]+)\/webhooks(?:\/([a-zA-Z0-9_-]+))?(?:\/([a-zA-Z0-9_-]+)\/retry)?$/);
  if (webhookMatch) {
    const [, businessId, branchId, resource, deliveryId] = webhookMatch;
    const admin = env.CONTROL_ADMIN;
    if (!resource && request.method === "GET")
      return fromRpc(await admin.branchWebhooks(actorEmail, businessId, branchId, "list", null, {}));
    if (resource === "deliveries" && !deliveryId && request.method === "GET")
      return fromRpc(await admin.branchWebhooks(actorEmail, businessId, branchId, "deliveries", null, {}));
    if (resource === "deliveries" && !deliveryId && request.method === "DELETE")
      return fromRpc(await admin.clearWebhookHistory(actorEmail, businessId, branchId, url.searchParams.get("webhookId")));
    if (resource === "deliveries" && deliveryId && request.method === "POST")
      return fromRpc(await admin.branchWebhooks(actorEmail, businessId, branchId, "retry", deliveryId, {}));
    if (resource && !deliveryId && request.method === "DELETE")
      return fromRpc(await admin.branchWebhooks(actorEmail, businessId, branchId, "archive", resource, {}));
    if (!deliveryId && ((!resource && request.method === "POST") ||
      (resource && ["PUT", "PATCH"].includes(request.method)))) {
      const body = await bodyJson(request).catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return responseJson({ error: "Expected a JSON object" }, 400);
      const action = !resource ? "create" : request.method === "PATCH" ? "toggle" : "update";
      return fromRpc(await admin.branchWebhooks(actorEmail, businessId, branchId, action, resource ?? null, body),
        action === "create" ? 201 : 200);
    }
    return responseJson({ error: "Method not allowed" }, 405);
  }

  const branchMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/branches(?:\/([a-zA-Z0-9_-]+))?$/);
  if (branchMatch && ((!branchMatch[2] && ["GET","POST"].includes(request.method)) || (branchMatch[2] && request.method === "PUT"))) {
    const body = request.method === "GET" ? null : await bodyJson(request).catch(() => null);
    if (request.method !== "GET" && !body) return responseJson({ error: "Expected a JSON body" },400);
    return fromRpc(await env.CONTROL_ADMIN.businessBranches(actorEmail,branchMatch[1],branchMatch[2] || null,body));
  }

  const slugMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/slug$/);
  if (request.method === "PATCH" && slugMatch) {
    const body = await bodyJson(request).catch(() => null);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(await env.CONTROL_ADMIN.renameBusinessSlug(actorEmail, slugMatch[1], body));
  }

  const menuBrowsingMatch = path.match(/^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/menu-browsing$/);
  if (request.method === "PUT" && menuBrowsingMatch) {
    const body = await bodyJson(request).catch(() => null);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(await env.CONTROL_ADMIN.updateBusinessMenuBrowsing(actorEmail, menuBrowsingMatch[1], body));
  }

  const orderingSettingsMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_-]+)\/ordering-settings$/,
  );
  if (request.method === "PUT" && orderingSettingsMatch) {
    const body = await bodyJson(request).catch(() => null);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      await env.CONTROL_ADMIN.updateBusinessOrderingSettings(
        actorEmail,
        orderingSettingsMatch[1],
        body,
      ),
    );
  }

  const menuUrlMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_]+)\/menu-url$/,
  );
  if (request.method === "PATCH" && menuUrlMatch) {
    const body = await bodyJson(request);
    if (!body || typeof body.customMenuUrl !== "string")
      return responseJson({ error: "customMenuUrl must be a string" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.updateBusinessCustomMenuUrl(
        actorEmail,
        menuUrlMatch[1],
        body,
      )) as RpcResult,
    );
  }

  const credentialsMatch = path.match(
    /^\/api\/super\/users\/([a-zA-Z0-9_]+)\/credentials$/,
  );
  if (request.method === "PUT" && credentialsMatch) {
    const body = await bodyJson(request);
    if (!body) return responseJson({ error: "Expected a JSON body" }, 400);
    return fromRpc(
      (await env.CONTROL_ADMIN.updateCredentials(
        actorEmail,
        credentialsMatch[1],
        body,
      )) as RpcResult,
    );
  }

  const supportMatch = path.match(
    /^\/api\/super\/businesses\/([a-zA-Z0-9_]+)\/support-session$/,
  );
  if (request.method === "POST" && supportMatch)
    return fromRpc(
      (await env.CONTROL_ADMIN.createSupportSession(
        actorEmail,
        supportMatch[1],
      )) as RpcResult,
      201,
    );

  return responseJson({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      const actorEmail = await authenticatedEmail(
        request,
        env,
        context as AccessContext,
      );
      if (!actorEmail)
        return responseJson({ error: "Cloudflare Access is required" }, 401);
      return await handleApi(request, env, actorEmail);
    } catch (error) {
      const requestId = crypto.randomUUID();
      const message = error instanceof Error ? error.message : String(error);
      console.error("super_request_failed", {
        requestId,
        method: request.method,
        path: url.pathname,
        message,
      });
      const accessFailure =
        message.includes("JWT") ||
        message.includes("signature") ||
        message.includes("claim");
      return responseJson(
        {
          error: accessFailure
            ? "Cloudflare Access session is invalid or expired"
            : "Request could not be completed",
          requestId,
        },
        accessFailure ? 401 : 500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
