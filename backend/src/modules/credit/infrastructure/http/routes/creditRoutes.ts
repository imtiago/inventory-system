import type { FastifyInstance } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { authorize } from "../../../../../shared/middleware/authorize";

export async function creditRoutes(app: FastifyInstance) {
  // Quem pode aprovar crédito (ADMIN ou marcado), para o seletor do modal de autorização.
  app.get("/approvers", { preHandler: [authorize("sales.create")] }, async (_request, reply) => {
    const users = await getDb().user.findMany({
      where: { active: true, OR: [{ role: "ADMIN" }, { canApproveCredit: true }] },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return reply.send(HttpResponse.ok(users));
  });

  // Sonda de `credit.approve`: 200 só para quem pode aprovar.
  app.get("/approvers/me", { preHandler: [authorize("credit.approve")] }, async (_request, reply) =>
    reply.send(HttpResponse.ok({ canApprove: true })),
  );
}
