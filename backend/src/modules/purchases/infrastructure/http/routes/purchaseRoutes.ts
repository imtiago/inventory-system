import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import {
  makeCancelPurchaseController,
  makeCreatePurchaseController,
  makeGetPurchaseController,
  makeListPurchasesController,
  makeReceivePurchaseController,
} from "../controllers/purchaseControllers";

export async function purchaseRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authorize("purchases.read")] }, makeListPurchasesController());
  app.get("/:id", { preHandler: [authorize("purchases.read")] }, makeGetPurchaseController());
  app.post("/", { preHandler: [authorize("purchases.write")] }, makeCreatePurchaseController());
  app.post("/:id/cancel", { preHandler: [authorize("purchases.write")] }, makeCancelPurchaseController());
  app.post("/:id/receipts", { preHandler: [authorize("purchases.receive")] }, makeReceivePurchaseController());
}
