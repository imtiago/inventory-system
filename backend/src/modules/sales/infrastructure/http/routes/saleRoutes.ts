import { FastifyInstance } from "fastify";
import { makeCreateSaleController } from "../controllers/CreateSaleController";
import { makeListSalesController } from "../controllers/ListSalesController";
import { makeGetSaleController } from "../controllers/GetSaleController";
import { makeCancelSaleController } from "../controllers/CancelSaleController";
import {
  makeApproveSaleCancelRequestController,
  makeCountSaleCancelRequestsController,
  makeListSaleCancelRequestsController,
  makeRejectSaleCancelRequestController,
  makeRequestSaleCancelController,
} from "../controllers/SaleCancelRequestControllers";
import { authorize } from "../../../../../shared/middleware/authorize";
import { idempotent } from "@shared/http/idempotency/idempotent";

export async function saleRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("sales.create")] },
    idempotent(makeCreateSaleController()),
  );
  app.get(
    "/:id",
    { preHandler: [authorize("sales.read")] },
    makeGetSaleController(),
  );
  app.post(
    "/:id/cancel",
    { preHandler: [authorize("sales.cancel")] },
    idempotent(makeCancelSaleController()),
  );
  app.post(
    "/:id/cancel-requests",
    { preHandler: [authorize("sales.cancel.request")] },
    makeRequestSaleCancelController(),
  );
  app.get(
    "/cancel-requests",
    { preHandler: [authorize("sales.cancel")] },
    makeListSaleCancelRequestsController(),
  );
  app.get(
    "/cancel-requests/count",
    { preHandler: [authorize("sales.cancel")] },
    makeCountSaleCancelRequestsController(),
  );
  app.post(
    "/cancel-requests/:id/approve",
    { preHandler: [authorize("sales.cancel")] },
    idempotent(makeApproveSaleCancelRequestController()),
  );
  app.post(
    "/cancel-requests/:id/reject",
    { preHandler: [authorize("sales.cancel")] },
    makeRejectSaleCancelRequestController(),
  );
  app.get(
    "/",
    { preHandler: [authorize("sales.read")] },
    makeListSalesController(),
  );
}
