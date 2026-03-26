// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { CreateProduct } from "../../../application/useCases/CreateProduct";
import { createProductSchema } from "../../../interfaces/http/schemas/createProductSchema";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { InventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";

export function makeCreateProductController(
  brandRepo: BrandRepository,
  categoryRepo: CategoryRepository,
  productRepo: ProductRepository,
  productVariantRepo: ProductVariantRepository,
  inventoryRepo: InventoryRepository,
  transactionManager: TransactionManager,
) {
  return async function CreateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createProductSchema.parse(request.body); // usa seu schema existente
      const useCase = new CreateProduct(
        brandRepo,
        categoryRepo,
        productRepo,
        productVariantRepo,
        inventoryRepo,
        transactionManager,
      );
      const product = await useCase.execute(data);
      return reply.status(201).send(product);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
