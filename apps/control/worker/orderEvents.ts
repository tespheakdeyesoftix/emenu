import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";
import { posResponse, withPosIdentity } from "./posSync";

type SubmittedOrderEvent = {
  type: "order.submitted";
  order: {
    id: string;
    order_number: string;
    table_id: string;
    branch_id: string;
    posting_date: string;
    submitted_at: string | null;
    total_quantity: number;
    total_amount: number;
    currency: string;
  };
};

const isUpgrade = (request: Request) =>
  request.headers.get("upgrade")?.toLowerCase() === "websocket";

export function connectPosOrderEvents(request: Request, env: Env) {
  if (request.method !== "GET")
    return posResponse({ error: "Method not allowed" }, 405, { allow: "GET" });
  if (!isUpgrade(request))
    return posResponse({ error: "WebSocket upgrade required" }, 426, {
      upgrade: "websocket",
    });

  return withPosIdentity(request, env, async ({ businessId }, tokenHash) => {
    if (!env.ORDER_EVENTS)
      return posResponse({ error: "Order events are unavailable" }, 503);
    const headers = new Headers(request.headers);
    headers.delete("authorization");
    headers.set("x-order-events-key-hash", tokenHash);
    return env.ORDER_EVENTS.getByName(businessId).fetch(
      new Request(request, { headers }),
    );
  });
}

export class OrderEvents extends DurableObject<Env> {
  fetch(request: Request) {
    const tokenHash = request.headers.get("x-order-events-key-hash");
    if (!isUpgrade(request) || !tokenHash)
      return new Response(null, { status: 400 });

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [tokenHash]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async broadcast(businessId: string, event: SubmittedOrderEvent) {
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;

    // Recheck the key before publishing to sockets that may have been idle.
    const tokenHash = await this.env.DB.prepare(
      `SELECT i.token_hash FROM pos_integrations i JOIN businesses b ON b.id=i.business_id
       WHERE i.business_id=? AND b.is_active=1`,
    )
      .bind(businessId)
      .first<string>("token_hash");
    const message = JSON.stringify(event);
    for (const socket of sockets) {
      try {
        if (tokenHash && this.ctx.getTags(socket).includes(tokenHash))
          socket.send(message);
        else socket.close(4401, "POS key is no longer valid");
      } catch {
        // A client can disconnect while the key is being checked.
      }
    }
  }
}
