import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditSettingsReader } from "@credit/application/contracts/CreditSettingsReader";
import type { LateFeeOrigin, LateFeeRates, LateFeeRatesReader } from "@finance/application/contracts/LateFeeRatesReader";

/**
 * Venda do crediário: termos gravados no `SaleFinancing` (mudar as configurações depois não muda dívida
 * antiga). Sem financiamento (venda antiga, conta avulsa): valores atuais de `CreditSettings`.
 */
export class PrismaLateFeeRatesReader implements LateFeeRatesReader {
  constructor(private readonly settings: CreditSettingsReader) {}

  async rates(origin: LateFeeOrigin): Promise<LateFeeRates> {
    if (origin.originType === "SALE") {
      const snapshot = await getDb().saleFinancing.findUnique({
        where: { saleId: origin.originId },
        select: { fineBps: true, monthlyInterestBps: true, graceDays: true },
      });
      if (snapshot) return snapshot;
    }
    const { rules } = await this.settings.get();
    return { fineBps: rules.fineBps, monthlyInterestBps: rules.monthlyInterestBps, graceDays: rules.graceDays };
  }
}
