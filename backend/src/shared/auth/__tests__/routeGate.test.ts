import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import type { RouteOptions } from "fastify";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { authorizedPermission } from "../../middleware/authorize";
import { PERMISSIONS } from "../permissions";

app.log.level = "silent";

// Registrado antes do app ficar pronto: os plugins de rota (carregados no ready)
// herdam o hook e reportam cada rota criada.
const routes: RouteOptions[] = [];
app.addHook("onRoute", (route) => {
  routes.push(route);
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
});

test("toda rota (exceto POST /auth/login) tem um preHandler de authorize com permissão conhecida", async () => {
  await app.ready();

  const ungated: string[] = [];
  let checked = 0;
  for (const route of routes) {
    const methods = (Array.isArray(route.method) ? route.method : [route.method]).filter(
      (m) => m !== "HEAD" && m !== "OPTIONS",
    );
    if (methods.length === 0) continue;
    const label = `${methods.join(",")} ${route.url}`;
    if (label === "POST /auth/login") continue;

    checked++;
    const preHandlers = [route.preHandler ?? []].flat();
    const permissions = preHandlers
      .map((h) => authorizedPermission(h))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
    if (permissions.length !== 1 || !PERMISSIONS.includes(permissions[0])) ungated.push(label);
  }

  assert.ok(checked > 50, `rotas verificadas: ${checked}`);
  assert.deepEqual(ungated, []);
});
