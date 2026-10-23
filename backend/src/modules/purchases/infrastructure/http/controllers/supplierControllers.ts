import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import {
  createSupplierBodySchema,
  listSuppliersSchema,
  supplierIdParamsSchema,
  updateSupplierBodySchema,
} from "@purchases/interfaces/http/schemas/supplierSchemas";
import { SupplierHttpPresenter } from "@purchases/interfaces/http/presenters/SupplierHttpPresenter";
import {
  makeCreateSupplierUseCase,
  makeDeleteSupplierUseCase,
  makeGetSupplierUseCase,
  makeListSuppliersUseCase,
  makeUpdateSupplierUseCase,
} from "../factories/SupplierFactories";

export function makeCreateSupplierController() {
  const useCase = makeCreateSupplierUseCase();
  return async function CreateSupplierController(request: FastifyRequest, reply: FastifyReply) {
    const data = parseInput(createSupplierBodySchema, request.body);
    const supplier = await useCase.execute(data);
    return reply.status(201).send(HttpResponse.created(SupplierHttpPresenter.toHTTP(supplier)));
  };
}

export function makeUpdateSupplierController() {
  const useCase = makeUpdateSupplierUseCase();
  return async function UpdateSupplierController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(supplierIdParamsSchema, request.params);
    const patch = parseInput(updateSupplierBodySchema, request.body);
    const supplier = await useCase.execute({ id, ...patch });
    return reply.send(HttpResponse.ok(SupplierHttpPresenter.toHTTP(supplier)));
  };
}

export function makeGetSupplierController() {
  const useCase = makeGetSupplierUseCase();
  return async function GetSupplierController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(supplierIdParamsSchema, request.params);
    const supplier = await useCase.execute(id);
    return reply.send(HttpResponse.ok(SupplierHttpPresenter.toHTTP(supplier)));
  };
}

export function makeListSuppliersController() {
  const useCase = makeListSuppliersUseCase();
  return async function ListSuppliersController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listSuppliersSchema, request.query);
    const result = await useCase.execute(query);
    return reply.send(HttpResponse.paginated(result));
  };
}

export function makeDeleteSupplierController() {
  const useCase = makeDeleteSupplierUseCase();
  return async function DeleteSupplierController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(supplierIdParamsSchema, request.params);
    await useCase.execute({ id });
    return reply.status(204).send();
  };
}
