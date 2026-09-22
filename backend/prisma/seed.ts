import { PrismaClient } from "@prisma/client";

import { seedBrands } from "./seeds/brand.seed";
import { seedCategories } from "./seeds/category.seed";
import { seedCustomers } from "./seeds/customer.seed";
import { seedNumberRanges } from "./seeds/number-range.seed";

const prisma = new PrismaClient();

async function main() {
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
