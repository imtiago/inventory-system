import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import {
  cancelPurchaseBodySchema,
  createPurchaseBodySchema,
  listPurchasesSchema,
  purchaseIdParamsSchema,
} from "@purchases/interfaces/http/schemas/purchaseSchemas";
import {
  makeCancelPurchaseUseCase,
  makeCreatePurchaseUseCase,
  makeGetPurchaseUseCase,
  makeListPurchasesUseCase,
} from "../factories/PurchaseFactories";

export function makeCreatePurchaseController() {
  const createPurchase = makeCreatePurchaseUseCase();
  const getPurchase = makeGetPurchaseUseCase();
  return async function CreatePurchaseController(request: FastifyRequest, reply: FastifyReply) {
    const body = parseInput(createPurchaseBodySchema, request.body);
    const purchase = await createPurchase.execute(body);
    return reply.status(201).send(HttpResponse.created(await getPurchase.execute(purchase.id)));
  };
}

export function makeCancelPurchaseController() {
  const cancelPurchase = makeCancelPurchaseUseCase();
  const getPurchase = makeGetPurchaseUseCase();
  return async function CancelPurchaseController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(purchaseIdParamsSchema, request.params);
    const { reason } = parseInput(cancelPurchaseBodySchema, request.body);
    await cancelPurchase.execute({ id, reason, userId: request.user!.sub });
    // Mesmo DTO do GET /purchases/:id.
    return reply.send(HttpResponse.ok(await getPurchase.execute(id)));
  };
}

export function makeGetPurchaseController() {
  const useCase = makeGetPurchaseUseCase();
  return async function GetPurchaseController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(purchaseIdParamsSchema, request.params);
    return reply.send(HttpResponse.ok(await useCase.execute(id)));
  };
}

export function makeListPurchasesController() {
  const useCase = makeListPurchasesUseCase();
  return async function ListPurchasesController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listPurchasesSchema, request.query);
    return reply.send(HttpResponse.paginated(await useCase.execute(query)));
  };
}
