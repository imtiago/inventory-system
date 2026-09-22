import { PrismaClient } from "@prisma/client";

export async function seedCategories(prisma: PrismaClient) {
  await prisma.category.createMany({
    data: [
      {
        name: "Perfumes",
      },
      {
        name: "Maquiagens",
      },
    ],
  });

  console.log("Categories criadas com sucesso");
}
