import { FastifyRequest, FastifyReply } from "fastify";
import { makeUpdateCustomerUseCase } from "../factories/UpdateCustomerFactory";
import { createCustomerSchema } from "@customer/interfaces/http/schemas/createCustomerSchema";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";

export function makeUpdateCustomerController() {
  const useCase = makeUpdateCustomerUseCase();
  return async function UpdateCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params as { id: string };
      const data = createCustomerSchema.parse(request.body);

      const updatedProduct = await useCase.execute({ id, ...data });

      return reply
        .status(200)
        .send(CustomerHttpPresenter.toHTTP(updatedProduct));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
