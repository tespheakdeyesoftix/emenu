import { randomBytes, webcrypto } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const AUTH_VERSION = "client-pbkdf2-sha256-v1";
const API_URL =
  process.env.ANGKOR_EMENU_API_URL ||
  "https://angkor-emenu-api.pheakdey-micronet.workers.dev";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const controlDirectory = join(root, "apps", "control");
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

async function promptLine(label) {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(label);
  prompt.close();
  return answer;
}

function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode)
    throw new Error("Run this command in an interactive terminal.");
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(label);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (data) => {
      for (const character of data) {
        if (character === "\u0003") {
          finish();
          reject(new Error("Password reset cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          process.stdout.write("*");
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createPasswordProof(email, password) {
  const encoder = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const proof = await webcrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 120_000,
      salt: encoder.encode(
        `angkor-emenu:${AUTH_VERSION}:${email.toLowerCase()}`,
      ),
    },
    key,
    256,
  );
  return bytesToHex(proof);
}

function runWrangler(args, input) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: controlDirectory,
    input,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Wrangler exited with code ${result.status ?? "unknown"}.`);
}

const email = (argument("--email") || (await promptLine("Registered email: ")))
  .trim()
  .toLowerCase();
if (!email.includes("@")) throw new Error("Enter a valid registered email.");
const newEmail = (argument("--new-email") || email).trim().toLowerCase();
if (!newEmail.includes("@")) throw new Error("Enter a valid new email.");

const password = await promptHidden("New password: ");
const confirmation = await promptHidden("Confirm new password: ");
if (password.length < 8)
  throw new Error("The new password must have at least 8 characters.");
if (password !== confirmation) throw new Error("Passwords do not match.");

const passwordProof = await createPasswordProof(newEmail, password);
const recoveryKey = randomBytes(48).toString("base64url");
let secretCreated = false;

try {
  console.log("Enabling one-time account recovery…");
  runWrangler(["secret", "put", "PASSWORD_RESET_KEY"], `${recoveryKey}\n`);
  secretCreated = true;

  const response = await fetch(`${API_URL}/api/auth/recovery-reset`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${recoveryKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      newEmail,
      passwordProof,
      authVersion: AUTH_VERSION,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result.error || `Password reset failed (${response.status}).`,
    );
  console.log(
    "Password reset completed. You can now sign in with the new password.",
  );
} finally {
  if (secretCreated) {
    console.log("Disabling account recovery…");
    try {
      runWrangler(["secret", "delete", "PASSWORD_RESET_KEY"], "y\n");
    } catch {
      console.warn(
        "Could not remove PASSWORD_RESET_KEY automatically. Run: npx wrangler secret delete PASSWORD_RESET_KEY",
      );
    }
  }
}
