import { BusinessRuleError, ErrorCodes, NotFoundError, ValidationError } from "@shared/domain/errors";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { buildInstallments } from "@shared/domain/installments";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { FinancialService } from "@finance/application/services/FinacialService";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { PurchaseItem } from "@purchases/domain/entities/PurchaseItem";
import { supplierNotFound } from "@purchases/domain/errors/supplierErrors";
import { PurchaseRepository } from "@purchases/domain/repositories/PurchaseRepository";
import { SupplierRepository } from "@purchases/domain/repositories/SupplierRepository";
import { ICreatePurchaseInput } from "../../dto/PurchaseDTO";

const PURCHASE_CODE_PREFIX = "PC";

/**
 * Cria o pedido numa transação: valida fornecedor e variantes → calcula itens
 * (centavos; 422 se total do item < 0) → código PC###### → grava o pedido →
 * contas a pagar com parcelas do mesmo plano das vendas. Falha desfaz tudo
 * (inclusive o incremento da faixa de numeração).
 */
export class CreatePurchaseUseCase extends TransactionalUseCase<ICreatePurchaseInput, Purchase> {
  constructor(
    private readonly purchases: PurchaseRepository,
    private readonly suppliers: SupplierRepository,
    transactionManager: TransactionManager,
    private readonly catalogService: CatalogService,
    private readonly financialService: FinancialService,
    private readonly numberGenerator: NumberGenerator,
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

    const supplier = await this.suppliers.findById(request.supplierId);
    if (!supplier) throw supplierNotFound();

    const items: PurchaseItem[] = [];
    for (const item of request.items) {
      const variant = await this.catalogService.getProductVariant(item.productVariantId);
      if (!variant) throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
      items.push(new PurchaseItem({ ...item, productVariantId: variant.id }));
    }

    const code = await this.numberGenerator.generate(NumberRangeName.PURCHASE, PURCHASE_CODE_PREFIX);
    const purchase = Purchase.create({
      code,
      supplierId: supplier.id,
      purchaseDate,
      notes: request.notes,
      items,
    });

    // Cada parcela precisa de ao menos 1 centavo.
    if (purchase.totalAmountCents < installments) {
      throw new BusinessRuleError(
        "O valor do pedido não permite esse número de parcelas.",
        ErrorCodes.INSTALLMENTS_EXCEED_TOTAL,
      );
    }

    const created = await this.purchases.create(purchase);

    const plan = buildInstallments(
      purchase.totalAmountCents,
      installments,
      new Date(`${firstDueDate}T00:00:00.000Z`),
    );
    await this.financialService.createPurchasePayable({
      purchaseId: purchase.id,
      supplierId: supplier.id,
      parcels: plan.map((p) => ({ amountCents: p.amountCents, dueDate: p.dueDate })),
    });

    return created;
  }
}
