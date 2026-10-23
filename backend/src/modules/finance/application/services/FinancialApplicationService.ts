import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { toCents } from "@shared/domain/money";
import { CreateFinancialDocumentUseCase } from "../useCases/commands/CreateFinancialDocumentUseCase";
import { CancelSaleReceivableUseCase } from "../useCases/commands/CancelSaleReceivableUseCase";
import { CancelPurchasePayableUseCase } from "../useCases/commands/CancelPurchasePayableUseCase";
import {
  CreatePurchasePayableInput,
  CreateSaleReceivableInput,
  FinancialService,
} from "./FinacialService";

export class FinancialApplicationService implements FinancialService {
  constructor(
    private readonly createDocumentUseCase: Pick<CreateFinancialDocumentUseCase, "execute">,
    private readonly cancelSaleReceivableUseCase: Pick<CancelSaleReceivableUseCase, "execute">,
    private readonly cancelPurchasePayableUseCase: Pick<CancelPurchasePayableUseCase, "execute">,
  ) {}

  async createSaleReceivable(input: CreateSaleReceivableInput): Promise<void> {
    await this.createDocumentUseCase.execute({
      type: FinancialType.RECEIVABLE,
      originType: FinancialOriginType.SALE,
      originId: input.saleId,
      partyType: FinancialPartyType.CUSTOMER,
      partyId: input.customerId,
      parcels: input.parcels.map((p) => ({ amountCents: toCents(p.amount), dueDate: p.dueDate })),
    });
  }

  async cancelSaleReceivable(saleId: string): Promise<void> {
    await this.cancelSaleReceivableUseCase.execute({ saleId });
  }

  async createPurchasePayable(input: CreatePurchasePayableInput): Promise<void> {
    await this.createDocumentUseCase.execute({
      type: FinancialType.PAYABLE,
      originType: FinancialOriginType.PURCHASE,
      originId: input.purchaseId,
      partyType: FinancialPartyType.SUPPLIER,
      partyId: input.supplierId,
      parcels: input.parcels,
    });
  }

  async cancelPurchasePayable(purchaseId: string): Promise<void> {
    await this.cancelPurchasePayableUseCase.execute({ purchaseId });
  }
}
