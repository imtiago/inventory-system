import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";

export async function createTestVariant(): Promise<{
  variantId: string;
  cleanup(): Promise<void>;
}> {
  const tag = `tx-test-${randomUUID()}`;
  const brand = await prisma.brand.create({ data: { name: tag } });
  const category = await prisma.category.create({ data: { name: tag } });
  const product = await prisma.product.create({
    data: { name: tag, code: `${tag}-p`, brandId: brand.id, categoryId: category.id },
  });
  const variant = await prisma.productVariant.create({
    data: { name: tag, code: `${tag}-v`, productId: product.id },
  });
  const variantId = variant.id;

  return {
    variantId,
    async cleanup() {
      await prisma.inventoryBoxStock.deleteMany({
        where: { inventoryLot: { productVariantId: variantId } },
      });
      await prisma.stockMovement.deleteMany({ where: { productVariantId: variantId } });
      await prisma.inventoryLot.deleteMany({ where: { productVariantId: variantId } });
      await prisma.inventory.deleteMany({ where: { productVariantId: variantId } });
      await prisma.productVariant.delete({ where: { id: variantId } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.category.delete({ where: { id: category.id } });
      await prisma.brand.delete({ where: { id: brand.id } });
    },
  };
}

export async function getTestUserId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: "tx-test-inventory@local" },
    update: {},
    create: {
      name: "tx-test-inventory",
      email: "tx-test-inventory@local",
      password: "tx-test",
      role: "ADMIN",
    },
  });
  return user.id;
}
