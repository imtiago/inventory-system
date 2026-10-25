import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildApp } from "../../../app";
import { installGracefulShutdown } from "../gracefulShutdown";

const quiet = { logger: false } as const;
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("instala handlers para SIGTERM e SIGINT", () => {
  const signals = new EventEmitter();
  installGracefulShutdown(
    { close: async () => {}, log: { info() {}, error() {} } },
    { timeoutMs: 1000, exit: () => {}, signals: signals as never },
  );
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  assert.equal(signals.listenerCount("SIGINT"), 1);
});

test("SIGTERM: requisição lenta termina antes de exit(0)", async () => {
  const app = buildApp({
    ...quiet,
    healthCheck: async () => {
      await tick(300);
    },
  });
  const events: string[] = [];
  app.addHook("onResponse", async (_req, reply) => {
    events.push(`response:${reply.statusCode}`);
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as { port: number };
  const signals = new EventEmitter();
  const exited = new Promise<number>((resolve) => {
    installGracefulShutdown(app, {
      timeoutMs: 5000,
      exit: (code) => {
        events.push(`exit:${code}`);
        resolve(code);
      },
      signals: signals as never,
    });
  });
  const pending = fetch(`http://127.0.0.1:${port}/health`, { headers: { connection: "close" } });
  await tick(50);
  signals.emit("SIGTERM");
  assert.equal(await exited, 0);
  assert.equal((await pending).status, 200);
  assert.deepEqual(events, ["response:200", "exit:0"]);
});

test("timeout força exit(1) se o close travar", async () => {
  const signals = new EventEmitter();
  let codes: number[] = [];
  const exited = new Promise<void>((resolve) => {
    installGracefulShutdown(
      { close: () => new Promise<void>(() => {}), log: { info() {}, error() {} } },
      {
        timeoutMs: 50,
        exit: (code) => {
          codes.push(code);
          resolve();
        },
        signals: signals as never,
      },
    );
  });
  signals.emit("SIGINT");
  await exited;
  assert.deepEqual(codes, [1]);
});

test("segundo sinal durante o encerramento é ignorado", async () => {
  const signals = new EventEmitter();
  let closes = 0;
  const exited = new Promise<void>((resolve) => {
    installGracefulShutdown(
      {
        close: async () => {
          closes++;
          await tick(20);
        },
        log: { info() {}, error() {} },
      },
      { timeoutMs: 1000, exit: () => resolve(), signals: signals as never },
    );
  });
  signals.emit("SIGTERM");
  signals.emit("SIGINT");
  await exited;
  assert.equal(closes, 1);
});
