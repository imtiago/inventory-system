import { prisma } from "@shared/prisma";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialParcelMapper } from "../mappers/FinancialParcelMapper";

export class PrismaFinancialParcelRepository implements FinancialParcelRepository {
  async createMany(data: FinancialParcel[], tx = prisma) {
    await tx.financialParcel.createMany({
      data: data.map((d) => FinancialParcelMapper.toCreatePersistence(d)),
    });

    return data;
  }
}
