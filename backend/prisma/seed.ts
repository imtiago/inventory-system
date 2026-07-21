import { PrismaClient } from "@prisma/client";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";

const prisma = new PrismaClient();

async function main() {
  await prisma.brand.create({
    data: {
      name: "Natura",
    },
  });

  await prisma.category.create({
    data: {
      name: "Perfumes",
    },
  });

  await prisma.numberRange.createMany({
    data: Object.values(NumberRangeName).map((name) => ({
      name,
      currentValue: 0,
    })),
    skipDuplicates: true,
  });

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
