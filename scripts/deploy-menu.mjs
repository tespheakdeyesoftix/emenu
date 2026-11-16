import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const menuRoot = join(projectRoot, "apps", "menu");
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
  "Type-check QR menu",
  process.execPath,
  [npmCli, "run", "typecheck", "-w", "@menuflow/menu"],
  projectRoot,
);
run(
  "Build QR menu",
  process.execPath,
  [npmCli, "run", "build", "-w", "@menuflow/menu"],
  projectRoot,
);
run(
  "Publish QR menu",
  process.execPath,
  [
    wranglerCli,
    "pages",
    "deploy",
    "dist",
    "--project-name",
    "angkor-emenu-menu",
    "--branch",
    "main",
  ],
  menuRoot,
);

console.log("\nQR menu published: https://angkor-emenu-menu.pages.dev\n");
