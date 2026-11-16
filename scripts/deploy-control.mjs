import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const controlRoot = join(projectRoot, "apps", "control");
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

run(
  "Type-check Control",
  process.execPath,
  [npmCli, "run", "typecheck", "-w", "@menuflow/control"],
  projectRoot,
);
run(
  "Build Control",
  process.execPath,
  [npmCli, "run", "build", "-w", "@menuflow/control"],
  projectRoot,
);
run(
  "Apply production D1 migrations",
  process.execPath,
  [
    wranglerCli,
    "d1",
    "migrations",
    "apply",
    "angkor-emenu",
    "--remote",
  ],
  controlRoot,
);
run(
  "Deploy API Worker",
  process.execPath,
  [wranglerCli, "deploy"],
  controlRoot,
);
run(
  "Publish Control app",
  process.execPath,
  [
    wranglerCli,
    "pages",
    "deploy",
    "dist",
    "--project-name",
    "angkor-emenu-admin",
    "--branch",
    "main",
  ],
  controlRoot,
);

console.log(`
Control deployment completed successfully:
- Management: https://angkor-emenu-admin.pages.dev
- API: https://angkor-emenu-api.pheakdey-micronet.workers.dev/health
`);
