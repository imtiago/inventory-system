import { PrismaClient } from "@prisma/client";

import { seedBrands } from "./seeds/brand.seed";
import { seedCategories } from "./seeds/category.seed";
import { seedCustomers } from "./seeds/customer.seed";
import { seedNumberRanges } from "./seeds/number-range.seed";
import { checkSeedAllowed } from "../src/scripts/seedGuard";

const prisma = new PrismaClient();

async function main() {
  const [brands, categories, customers, products] = await Promise.all([
    prisma.brand.count(),
    prisma.category.count(),
    prisma.customer.count(),
    prisma.product.count(),
  ]);
  const refusal = checkSeedAllowed({
    nodeEnv: process.env.NODE_ENV,
    force: process.argv.includes("--force"),
    hasData: brands + categories + customers + products > 0,
  });
  if (refusal) throw new Error(refusal);

  await seedBrands(prisma);
  await seedCategories(prisma);
  await seedNumberRanges(prisma);
  await seedCustomers(prisma);

  console.log("Seed executado com sucesso");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
