// src/modules/catalog/infrastructure/http/controllers/ListProductsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListProductsUseCase } from "../factories/ListProductsFactory";
import { ProductHttpPresenter } from "@catalog/interfaces/http/presenters/ProductHttpPresenter";

export function makeListProductsController() {
  const useCase = makeListProductsUseCase();
  return async function ListProductsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    // const products = await useCase.execute(Number(page), Number(limit));
    const products = await useCase.execute();
    return reply.send(products);
    // return reply.send(ProductHttpPresenter.toHTTPList(products));
  };
}
