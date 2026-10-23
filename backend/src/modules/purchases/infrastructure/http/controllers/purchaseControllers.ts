import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { hasPermission } from "@shared/auth/permissions";
import { PurchaseDTO } from "@purchases/application/dto/PurchaseDTO";
import {
  cancelPurchaseBodySchema,
  createPurchaseBodySchema,
  listPurchasesSchema,
  purchaseIdParamsSchema,
  receivePurchaseBodySchema,
} from "@purchases/interfaces/http/schemas/purchaseSchemas";
import {
  makeCancelPurchaseUseCase,
  makeCreatePurchaseUseCase,
  makeGetPurchaseUseCase,
  makeListPurchasesUseCase,
  makeReceivePurchaseUseCase,
} from "../factories/PurchaseFactories";

/** Dados financeiros (parcelas) só para quem tem payables.read. */
function withPayableVisibility(purchase: PurchaseDTO, request: FastifyRequest): PurchaseDTO {
  return hasPermission(request.user!.role, "payables.read") ? purchase : { ...purchase, payable: null };
}

export function makeCreatePurchaseController() {
  const createPurchase = makeCreatePurchaseUseCase();
  const getPurchase = makeGetPurchaseUseCase();
  return async function CreatePurchaseController(request: FastifyRequest, reply: FastifyReply) {
    const body = parseInput(createPurchaseBodySchema, request.body);
    const purchase = await createPurchase.execute(body);
    return reply.status(201).send(HttpResponse.created(withPayableVisibility(await getPurchase.execute(purchase.id), request)));
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
    return reply.send(HttpResponse.ok(withPayableVisibility(await getPurchase.execute(id), request)));
  };
}

export function makeReceivePurchaseController() {
  const receivePurchase = makeReceivePurchaseUseCase();
  const getPurchase = makeGetPurchaseUseCase();
  return async function ReceivePurchaseController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(purchaseIdParamsSchema, request.params);
    const { items } = parseInput(receivePurchaseBodySchema, request.body);
    await receivePurchase.execute({ id, items, userId: request.user!.sub });
    // Mesmo DTO do GET /purchases/:id.
    return reply.status(201).send(HttpResponse.created(withPayableVisibility(await getPurchase.execute(id), request)));
  };
}

export function makeGetPurchaseController() {
  const useCase = makeGetPurchaseUseCase();
  return async function GetPurchaseController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(purchaseIdParamsSchema, request.params);
    return reply.send(HttpResponse.ok(withPayableVisibility(await useCase.execute(id), request)));
  };
}

export function makeListPurchasesController() {
  const useCase = makeListPurchasesUseCase();
  return async function ListPurchasesController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listPurchasesSchema, request.query);
    return reply.send(HttpResponse.paginated(await useCase.execute(query)));
  };
}
