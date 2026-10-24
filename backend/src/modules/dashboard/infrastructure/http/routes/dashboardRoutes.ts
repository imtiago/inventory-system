import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import { makeGetDashboardController } from "../controllers/GetDashboardController";

export async function dashboardRoutes(app: FastifyInstance) {
  // Qualquer usuário autenticado; cada seção só vem com a permissão correspondente.
  app.get("/", { preHandler: [authorize("self")] }, makeGetDashboardController());
}
