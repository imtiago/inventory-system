// src/modules/catalog/infrastructure/http/controllers/ListProductsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListProductsUseCase } from "../factories/ListProductsFactory";
import { ProductHttpPresenter } from "@catalog/interfaces/http/presenters/ProductHttpPresenter";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { listProductsSchema } from "@catalog/interfaces/http/schemas/listProductsSchema";

export function makeListProductsController() {
  const useCase = makeListProductsUseCase();
  return async function ListProductsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit, search } = listProductsSchema.parse(request.query);
    const products = await useCase.execute({ page, limit, search });
    return reply.send(products);
    // return reply.send(ProductHttpPresenter.toHTTPList(products));
  };
}
