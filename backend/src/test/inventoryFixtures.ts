import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";

type Step = () => Promise<unknown>;

// Runs every step even if some fail; throws an AggregateError at the end.
async function runAll(steps: Step[], message: string): Promise<void> {
  const errors: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      errors.push(e);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, message);
  }
}

export async function createTestVariant(): Promise<{
  variantId: string;
  cleanup(): Promise<void>;
}> {
  const tag = `tx-test-${randomUUID()}`;
  const ids: {
    brand?: string;
    category?: string;
    product?: string;
    variant?: string;
  } = {};

  // Deletes in dependency order; each step only runs for rows that were created.
  const cleanup = async () => {
    const steps: Step[] = [];
    if (ids.variant) {
      const variantId = ids.variant;
      steps.push(
        () =>
          prisma.inventoryBoxStock.deleteMany({
            where: { inventoryLot: { productVariantId: variantId } },
          }),
        () => prisma.stockMovement.deleteMany({ where: { productVariantId: variantId } }),
        () => prisma.inventoryLot.deleteMany({ where: { productVariantId: variantId } }),
        () => prisma.inventory.deleteMany({ where: { productVariantId: variantId } }),
        () => prisma.productVariant.deleteMany({ where: { id: variantId } }),
      );
    }
    if (ids.product) {
      const id = ids.product;
      steps.push(() => prisma.product.deleteMany({ where: { id } }));
    }
    if (ids.category) {
      const id = ids.category;
      steps.push(() => prisma.category.deleteMany({ where: { id } }));
    }
    if (ids.brand) {
      const id = ids.brand;
      steps.push(() => prisma.brand.deleteMany({ where: { id } }));
    }
    await runAll(steps, "test variant cleanup failed");
  };

  try {
    ids.brand = (await prisma.brand.create({ data: { name: tag } })).id;
    ids.category = (await prisma.category.create({ data: { name: tag } })).id;
    ids.product = (
      await prisma.product.create({
        data: { name: tag, code: `${tag}-p`, brandId: ids.brand, categoryId: ids.category },
      })
    ).id;
    ids.variant = (
      await prisma.productVariant.create({
        data: { name: tag, code: `${tag}-v`, productId: ids.product },
      })
    ).id;
  } catch (e) {
    try {
      await cleanup();
    } catch {
      // keep the original creation error
    }
    throw e;
  }

  return { variantId: ids.variant, cleanup };
}

export async function getTestUserId(): Promise<string> {
  // ON CONFLICT: arquivos de teste paralelos num banco vazio criam o mesmo usuário
  // ao mesmo tempo; o upsert do Prisma não é atômico nesse caso (P2002).
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "users" ("id", "name", "email", "password", "role")
    VALUES (gen_random_uuid()::text, 'tx-test-inventory', 'tx-test-inventory@local', 'tx-test', 'ADMIN')
    ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
    RETURNING "id"`;
  return rows[0].id;
}
