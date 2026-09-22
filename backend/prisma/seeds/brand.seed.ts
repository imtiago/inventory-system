import { PrismaClient } from "@prisma/client";

export async function seedBrands(prisma: PrismaClient) {
  await prisma.brand.createMany({
    data: [
      {
        name: "Natura",
      },
      {
        name: "Boticario",
      },
    ],
  });

  console.log("Brands criadas com sucesso");
}
