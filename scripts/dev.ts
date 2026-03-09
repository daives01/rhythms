import { spawn, type ChildProcess } from "node:child_process";

const children = new Set<ChildProcess>();

function start(name: string, command: string, args: string[]) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (signal) {
      shutdown(signal);
      return;
    }

    if (code && code !== 0) {
      process.exitCode = code;
    }

    shutdown();
  });

  child.on("error", (error) => {
    console.error(`[dev] failed to start ${name}:`, error);
    process.exitCode = 1;
    shutdown();
  });
}

let stopping = false;

function shutdown(signal: NodeJS.Signals = "SIGTERM") {
  if (stopping) {
    return;
  }

  stopping = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start("vite", "bun", ["run", "vite", "--host", "localhost"]);
start("convex", "bunx", ["convex", "dev"]);
