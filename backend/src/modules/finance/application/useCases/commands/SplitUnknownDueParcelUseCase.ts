import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { FinancialParcelRepository } from "@finance/domain/repositories/FinancialParcelRepository";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { UseCase } from "@shared/domain/UseCase";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { toCents } from "@shared/domain/money";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { FinancialDocumentDetailDTO } from "../../dto/FinancialDocumentReadDTO";
import { FinancialDocumentDetailReader } from "./RegisterPaymentUseCase";

export interface ISplitUnknownDueParcelInput {
  documentId: string;
  parcelId: string;
  /** Valores em reais (até 2 casas) e vencimentos "YYYY-MM-DD". */
  parcels: { dueDate: string; amount: number }[];
}

/**
 * Parcela o saldo "a combinar" de uma dívida do caderninho em parcelas com vencimento.
 * Trava o documento (FOR UPDATE), relê sob a trava, aplica a regra de domínio e grava.
 * Não gera encargos (o documento continua `noLateFees`) nem entra no histórico de crédito.
 */
export class SplitUnknownDueParcelUseCase<T extends FinancialType>
  implements UseCase<ISplitUnknownDueParcelInput, FinancialDocumentDetailDTO<T>>
{
  constructor(
    private readonly type: T,
    private readonly documents: FinancialDocumentRepository,
    private readonly parcels: FinancialParcelRepository,
    private readonly transactionManager: TransactionManager,
    private readonly detail: FinancialDocumentDetailReader<T>,
  ) {}

  async execute(input: ISplitUnknownDueParcelInput): Promise<FinancialDocumentDetailDTO<T>> {
    await this.transactionManager.execute(async () => {
      const document = await this.documents.lockById(input.documentId);
      if (!document || document.type !== this.type) {
        throw new NotFoundError("Conta não encontrada.", ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND);
      }
      const result = document.splitUnknownDueParcel(
        input.parcelId,
        input.parcels.map((p) => ({ amountCents: toCents(p.amount), dueDate: p.dueDate })),
        todayInBusinessTz(),
      );
      await this.parcels.replaceForSplit(result);
      await this.documents.update(document);
    });
    return this.detail.execute(input.documentId);
  }
}
