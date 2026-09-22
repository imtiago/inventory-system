import { PrismaClient } from "@prisma/client";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";

export async function seedNumberRanges(prisma: PrismaClient) {
  await prisma.numberRange.createMany({
    data: Object.values(NumberRangeName).map((name) => ({
      name,
      currentValue: 0,
    })),
    skipDuplicates: true,
  });

  console.log("Number ranges criados com sucesso");
}
