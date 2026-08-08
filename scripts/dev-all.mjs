import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const portFile = path.join(root, ".backend-port");

fs.rmSync(portFile, { force: true });

const backend = spawn("tsx", ["server/index.ts"], { cwd: root, stdio: "inherit" });

async function waitForPort(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (backend.exitCode !== null) process.exit(backend.exitCode);
    try {
      const port = fs.readFileSync(portFile, "utf8").trim();
      if (port) return port;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Backend did not report a port within 15s");
}

let vite;
try {
  const port = await waitForPort(15000);
  vite = spawn("vite", [], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, BACKEND_PORT: port },
  });
} catch (err) {
  backend.kill();
  console.error(err.message);
  process.exit(1);
}

const shutdown = () => {
  backend.kill();
  vite.kill();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
vite.on("exit", (code) => {
  backend.kill();
  process.exit(code ?? 0);
});
backend.on("exit", () => {
  vite.kill();
  process.exit(1);
});
