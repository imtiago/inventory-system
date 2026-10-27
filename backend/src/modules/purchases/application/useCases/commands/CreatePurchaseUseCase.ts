import { BusinessRuleError, ErrorCodes, ValidationError } from "@shared/domain/errors";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { buildInstallments } from "@shared/domain/installments";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { PurchaseCreator } from "../../services/PurchaseCreator";
import { ICreatePurchaseInput } from "../../dto/PurchaseDTO";

/**
 * Cria o pedido numa transação: valida fornecedor e variantes → calcula itens
 * (centavos; 422 se total do item < 0) → código PC###### → grava o pedido →
 * contas a pagar com parcelas do mesmo plano das vendas. Falha desfaz tudo
 * (inclusive o incremento da faixa de numeração).
 */
export class CreatePurchaseUseCase extends TransactionalUseCase<ICreatePurchaseInput, Purchase> {
  constructor(
    transactionManager: TransactionManager,
    private readonly purchaseCreator: PurchaseCreator,
  ) {
    super(transactionManager);
  }

  protected async handle(request: ICreatePurchaseInput): Promise<Purchase> {
    const purchaseDate = request.purchaseDate ?? todayInBusinessTz();
    const { installments } = request.paymentTerms;
    if (installments > 1 && !request.paymentTerms.firstDueDate) {
      throw new ValidationError("Dados inválidos.", [
        { field: "paymentTerms.firstDueDate", message: "Informe o primeiro vencimento." },
      ]);
    }
    const firstDueDate = request.paymentTerms.firstDueDate ?? purchaseDate;
    // "YYYY-MM-DD": comparação lexicográfica = cronológica.
    if (firstDueDate < purchaseDate) {
      throw new ValidationError("Dados inválidos.", [
        { field: "paymentTerms.firstDueDate", message: "O primeiro vencimento não pode ser anterior à data do pedido." },
      ]);
    }

    const purchase = await this.purchaseCreator.build({
      supplierId: request.supplierId,
      purchaseDate,
      notes: request.notes,
      extraCostsCents: request.extraCostsCents,
      items: request.items,
    });

    // Cada parcela precisa de ao menos 1 centavo.
    if (purchase.totalAmountCents < installments) {
      throw new BusinessRuleError(
        "O valor do pedido não permite esse número de parcelas.",
        ErrorCodes.INSTALLMENTS_EXCEED_TOTAL,
      );
    }

    const plan = buildInstallments(
      purchase.totalAmountCents,
      installments,
      new Date(`${firstDueDate}T00:00:00.000Z`),
    );
    return this.purchaseCreator.save(purchase, plan);
  }
}
