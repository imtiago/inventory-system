import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { CreateBrandUseCase } from "@catalog/application/useCases/commands/CreateBrandUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";

// Use case externo que chama um use case real e depois falha.
class CreateBrandThenFail extends TransactionalUseCase<
  { outer: string; inner: string },
  void
> {
  constructor(
    private readonly createBrand: CreateBrandUseCase,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(names: { outer: string; inner: string }) {
    await this.createBrand.execute({ name: names.outer });
    await this.createBrand.execute({ name: names.inner });
    throw new Error("falha depois de gravar");
  }
}

describe("use cases reais dentro de transação", () => {
  const createdNames: string[] = [];
  const tm = new PrismaTransactionManager();
  const brandRepository = new PrismaBrandRepository();
  const createBrand = new CreateBrandUseCase(brandRepository, tm);

  after(async () => {
    await prisma.brand.deleteMany({ where: { name: { in: createdNames } } });
    await prisma.$disconnect();
  });

  test("use case aninhado é desfeito quando o externo falha", async () => {
    const outer = `tx-test-${randomUUID()}`;
    const inner = `tx-test-${randomUUID()}`;
    createdNames.push(outer, inner);
    const uc = new CreateBrandThenFail(createBrand, tm);

    await assert.rejects(uc.execute({ outer, inner }), /falha depois de gravar/);

    assert.equal(await prisma.brand.count({ where: { name: { in: [outer, inner] } } }), 0);
  });

  test("use case isolado faz commit", async () => {
    const name = `tx-test-${randomUUID()}`;
    createdNames.push(name);

    await createBrand.execute({ name });

    assert.equal(await prisma.brand.count({ where: { name } }), 1);
  });
});
