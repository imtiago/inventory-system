import { FastifyInstance } from "fastify";
import { makeListCustomersController } from "../controllers/ListCustomersController";
import { makeGetCustomerController } from "../controllers/GetCustomerController";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCustomerController } from "../controllers/CreateCustomerController";
import { makeUpdateCustomerController } from "../controllers/UpdateCustomerController";
import {
  makeGetCustomerCreditController,
  makeUpdateCustomerCreditController,
} from "@credit/infrastructure/http/controllers/customerCreditControllers";

export async function customerRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("customers.write")] },
    makeCreateCustomerController(),
  );
  app.patch(
    "/:id",
    { preHandler: [authorize("customers.write")] },
    makeUpdateCustomerController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize("customers.read")] },
    makeGetCustomerController(),
  );
  // Ficha de crédito: leitura para quem vê clientes; ajuste manual só com credit.manage.
  app.get(
    "/:id/credit",
    { preHandler: [authorize("customers.read")] },
    makeGetCustomerCreditController(),
  );
  app.put(
    "/:id/credit",
    { preHandler: [authorize("credit.manage")] },
    makeUpdateCustomerCreditController(),
  );
  app.get(
    "/",
    { preHandler: [authorize("customers.read")] },
    makeListCustomersController(),
  );
}
