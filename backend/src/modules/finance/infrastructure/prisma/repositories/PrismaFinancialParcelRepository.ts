import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { fromCents } from "@shared/domain/money";
import { fromDateOnly } from "@finance/domain/services/receivableStatus";
import { FinancialParcelMapper } from "../mappers/FinancialParcelMapper";

export class PrismaFinancialParcelRepository implements FinancialParcelRepository {
  async createMany(data: FinancialParcel[]) {
    await getDb().financialParcel.createMany({
      data: data.map((d) => FinancialParcelMapper.toCreatePersistence(d)),
    });

    return data;
  }

  async replaceForSplit(result: {
    closedParcel: FinancialParcel | null;
    removedParcelId: string | null;
    newParcels: FinancialParcel[];
  }) {
    const db = getDb();
    if (result.removedParcelId) {
      await db.financialParcel.delete({ where: { id: result.removedParcelId } });
    }
    if (result.closedParcel) {
      const p = result.closedParcel;
      await db.financialParcel.update({
        where: { id: p.id },
        data: { amount: fromCents(p.amountCents), dueDate: fromDateOnly(p.dueDate), dueDateUnknown: false },
      });
    }
    if (result.newParcels.length > 0) await this.createMany(result.newParcels);
  }
}
