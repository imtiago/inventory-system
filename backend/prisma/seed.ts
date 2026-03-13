import { PrismaClient } from "@prisma/client";

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
