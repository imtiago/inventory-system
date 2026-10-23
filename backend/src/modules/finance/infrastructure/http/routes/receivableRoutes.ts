import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import { makeListReceivablesController } from "../controllers/ListReceivablesController";

export async function receivableRoutes(app: FastifyInstance) {
  // Contas a receber são criadas pelos fluxos de origem (ex.: venda), não por rota própria.
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListReceivablesController(),
  );
}
