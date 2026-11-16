import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const controlRoot = join(projectRoot, "apps", "control");
const menuRoot = join(projectRoot, "apps", "menu");
const siteRoot = join(projectRoot, "apps", "site");
const superControlRoot = join(projectRoot, "apps", "super-control");
const npmCli = process.env.npm_execpath;
const wranglerCli = join(
  projectRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

if (!npmCli || !existsSync(wranglerCli)) {
  console.error(
    "Dependencies are missing. Run `npm install` once, then retry.",
  );
  process.exit(1);
}

function run(label, executable, args, cwd) {
  console.log(`\n=== ${label} ===\n`);
  const result = spawnSync(executable, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`\n${label} could not start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\nDeployment stopped during: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const npm = (...args) =>
  run(
    `npm ${args.join(" ")}`,
    process.execPath,
    [npmCli, ...args],
    projectRoot,
  );
const wrangler = (label, cwd, ...args) =>
  run(label, process.execPath, [wranglerCli, ...args], cwd);

console.log("Deploying Angkor eMenu to the production Cloudflare account.");

npm("run", "typecheck");
npm("run", "build");

wrangler(
  "Apply production D1 migrations",
  controlRoot,
  "d1",
  "migrations",
  "apply",
  "angkor-emenu",
  "--remote",
);
wrangler("Deploy API Worker", controlRoot, "deploy");
wrangler("Deploy private super control", superControlRoot, "deploy");
wrangler(
  "Deploy management app",
  controlRoot,
  "pages",
  "deploy",
  "dist",
  "--project-name",
  "angkor-emenu-admin",
  "--branch",
  "main",
);
wrangler(
  "Deploy QR menu",
  menuRoot,
  "pages",
  "deploy",
  "dist",
  "--project-name",
  "angkor-emenu-menu",
  "--branch",
  "main",
);
wrangler(
  "Deploy SaaS website",
  siteRoot,
  "pages",
  "deploy",
  "dist",
  "--project-name",
  "angkor-emenu",
  "--branch",
  "main",
);

console.log(`
Angkor eMenu deployment completed successfully:
- Website: https://angkor-emenu.pages.dev
- Management: https://angkor-emenu-admin.pages.dev
- QR menu: https://angkor-emenu-menu.pages.dev/angkor-kitchen
- API: https://angkor-emenu-api.pheakdey-micronet.workers.dev/health
- Super control: https://angkor-emenu-super-control.pheakdey-micronet.workers.dev
`);
