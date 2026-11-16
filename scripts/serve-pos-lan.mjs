import { createServer, request as upstreamRequest } from "node:http";
import { networkInterfaces } from "node:os";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { host: { type: "string", default: "192.168.10.179" } },
});
const host = values.host;
const localAddresses = Object.values(networkInterfaces())
  .flat()
  .filter(Boolean);
if (
  !localAddresses.some(
    (address) =>
      address.family === "IPv4" &&
      !address.internal &&
      address.address === host,
  )
) {
  throw new Error(
    "Choose one explicit LAN IPv4 address assigned to this computer using --host. Wildcard and loopback addresses are not accepted.",
  );
}

const routes = new Map([
  ["/health", ["GET", "HEAD"]],
  ["/api/integrations/pos/sync", ["POST", "OPTIONS"]],
  ["/api/integrations/pos/sync/product", ["POST", "OPTIONS"]],
  ["/api/integrations/pos/sync/tables", ["POST", "OPTIONS"]],
  ["/api/integrations/pos/orders", ["GET", "OPTIONS"]],
]);
const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${host}:8787`);
  } catch {
    return json(res, 400, { error: "Invalid request URL" });
  }
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path === "/" && ["GET", "HEAD"].includes(req.method)) {
    res.writeHead(302, { location: "/health", "cache-control": "no-store" });
    return res.end();
  }
  const methods =
    routes.get(path) ??
    (/^\/api\/integrations\/pos\/orders\/[a-zA-Z0-9_-]{1,80}$/.test(path)
      ? ["GET", "PATCH", "OPTIONS"]
      : undefined);
  if (!methods)
    return json(res, 404, {
      error:
        "This LAN listener only exposes the health check and POS integration API.",
    });
  if (!methods.includes(req.method)) {
    res.setHeader("allow", methods.join(", "));
    return json(res, 405, { error: "Method not allowed" });
  }
  const headers = { ...req.headers, host: "127.0.0.1:8787" };
  delete headers["proxy-connection"];
  const upstream = upstreamRequest(
    {
      hostname: "127.0.0.1",
      port: 8787,
      method: req.method,
      path: path + url.search,
      headers,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(res);
      incoming.on("error", () => res.destroy());
    },
  );
  upstream.setTimeout(100_000, () =>
    upstream.destroy(new Error("Local API timeout")),
  );
  upstream.on("error", () => {
    if (res.headersSent) res.destroy();
    else
      json(res, 502, {
        error:
          "The local eMenu API is unavailable. Start npm run dev:api first.",
      });
  });
  req.on("aborted", () => upstream.destroy());
  res.on("close", () => {
    if (!res.writableEnded) upstream.destroy();
  });
  req.pipe(upstream);
});

server.on("error", (error) => {
  console.error(
    `Could not listen on ${host}:8787: ${error.code || error.message}`,
  );
  process.exitCode = 1;
});
server.listen(8787, host, () => {
  console.log(`POS LAN access: http://${host}:8787`);
  console.log(
    "Forwarding only /health and the POS sync and order routes to the localhost API.",
  );
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
