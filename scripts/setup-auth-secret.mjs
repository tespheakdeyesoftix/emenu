import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const controlDirectory = join(root, "apps", "control");
const existing = spawnSync(
  process.execPath,
  [wrangler, "secret", "list", "--format", "json"],
  {
    cwd: controlDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (existing.error) throw existing.error;
if (existing.status !== 0) {
  process.stderr.write(existing.stderr);
  process.exit(existing.status ?? 1);
}

const secrets = JSON.parse(existing.stdout);
if (secrets.some((secret) => secret.name === "AUTH_PEPPER")) {
  console.log("AUTH_PEPPER already exists. No changes were made.");
  process.exit(0);
}

const pepper = randomBytes(48).toString("base64url");
const result = spawnSync(
  process.execPath,
  [wrangler, "secret", "put", "AUTH_PEPPER"],
  {
    cwd: controlDirectory,
    input: `${pepper}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("AUTH_PEPPER was created without printing it.");
console.log("Do not run this setup again after users have registered.");
