import { FastifyInstance } from "fastify";
import { PrismaSaleRepository } from "../../repositories/PrismaSaleRepository";
import { CreateSaleController } from "../controllers/CreateSaleController";
import { ListSalesController } from "../controllers/ListSalesController";
import { GetSaleController } from "../controllers/GetSaleController";

export async function saleRoutes(app: FastifyInstance) {
  const saleRepo = new PrismaSaleRepository();

  app.post("/", (req, reply) => CreateSaleController(req, reply, saleRepo));
  app.get("/", (req, reply) => ListSalesController(req, reply, saleRepo));
  app.get("/:id", (req, reply) => GetSaleController(req, reply, saleRepo));
}
