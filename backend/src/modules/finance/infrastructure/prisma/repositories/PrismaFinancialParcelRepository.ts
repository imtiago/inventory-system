import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { FinancialParcelMapper } from "../mappers/FinancialParcelMapper";

export class PrismaFinancialParcelRepository implements FinancialParcelRepository {
  async createMany(data: FinancialParcel[]) {
    await getDb().financialParcel.createMany({
      data: data.map((d) => FinancialParcelMapper.toCreatePersistence(d)),
    });

    return data;
  }
}
