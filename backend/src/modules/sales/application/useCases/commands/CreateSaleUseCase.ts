import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ErrorCodes,
  NotFoundError,
  ValidationError,
} from "@shared/domain/errors";
import { businessTodayAsUtcDate } from "@shared/domain/businessDate";
import { fromCents, toCents } from "@shared/domain/money";
import { MAX_AMOUNT_CENTS } from "@shared/domain/limits";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { CustomerService } from "@customer/application/services/CustomerService";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { InventoryService } from "@inventory/application/services/InventoryService";
import { FinancialService } from "@finance/application/services/FinacialService";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";
import { SaleItem } from "@sales/domain/entities/SaleItem";
import { Sale } from "@sales/domain/entities/Sale";
import { buildInstallments } from "@shared/domain/installments";
import { ICreateSaleInput } from "@sales/application/dto/SaleDTO";

/**
 * Falta de estoque na venda: identifica o item na mensagem (mesma classe e código
 * do erro original; `details` leva a variante, o disponível e o vencido).
 */
function describeStockShortage(error: unknown, variantName: string): unknown {
  if (!(error instanceof DomainError) || !error.details) return error;
  const { available, expired } = error.details as { available?: number; expired?: number };
  if (typeof available !== "number") return error;
  const expiredPart = expired ? `; ${expired} vencida(s) — dê baixa manual dos vencidos.` : ".";
  const message = `Estoque insuficiente para ${variantName}: ${available} disponível(is) dentro da validade${expiredPart}`;
  if (error.code === ErrorCodes.EXPIRED_STOCK_ONLY) {
    return new ConflictError(message, error.code, error.details);
  }
  if (error.code === ErrorCodes.INSUFFICIENT_STOCK) {
    return new BusinessRuleError(message, error.code, error.details);
  }
  return error;
}

/**
 * Cria a venda numa transação: valida cliente → resolve variantes (preço > 0,
 * snapshot) → consome estoque em ordem de variante (originId = venda) → grava a
 * venda → gera contas a receber com as parcelas. Qualquer falha desfaz tudo.
 */
export class CreateSaleUseCase extends TransactionalUseCase<ICreateSaleInput, Sale> {
  constructor(
    private readonly saleRepository: SaleRepository,
    transactionManager: TransactionManager,
    private readonly customerService: CustomerService,
    private readonly catalogService: CatalogService,
    private readonly inventoryService: InventoryService,
    private readonly financialService: FinancialService,
  ) {
    super(transactionManager);
  }

  protected async handle(request: ICreateSaleInput): Promise<Sale> {
    const { installments } = request.paymentTerms;
    if (installments > 1 && !request.paymentTerms.firstDueDate) {
      throw new ValidationError("Dados inválidos.", [
        { field: "paymentTerms.firstDueDate", message: "Informe o primeiro vencimento." },
      ]);
    }
    const firstDueDate = request.paymentTerms.firstDueDate ?? businessTodayAsUtcDate();

    const customer = await this.customerService.getCustomer(request.customerId);
    if (!customer) {
      throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const saleItems: SaleItem[] = [];
    for (const item of request.items) {
      const variant = await this.catalogService.getProductVariant(item.productVariantId);
      if (!variant) {
        throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
      }
      const unitPriceCents = toCents(variant.salePrice);
      if (unitPriceCents <= 0) {
        throw new BusinessRuleError("Variante sem preço de venda.", ErrorCodes.VARIANT_WITHOUT_PRICE);
      }
      saleItems.push(
        new SaleItem({
          variantId: variant.id,
          variantName: variant.name,
          variantCode: variant.code,
          barcode: variant.barcode,
          quantity: item.quantity,
          unitPriceCents,
        }),
      );
    }

    const sale = new Sale({
      customerId: customer.id,
      sellerId: request.sellerId,
      items: saleItems,
    });

    // Teto de DECIMAL(12,2): antes de baixar estoque (senão o banco estoura → 500).
    if (sale.totalAmountCents > MAX_AMOUNT_CENTS) {
      throw new ValidationError("Dados inválidos.", [
        { field: "items", message: "O total da venda excede o máximo permitido." },
      ]);
    }

    // Cada parcela precisa de ao menos 1 centavo.
    if (sale.totalAmountCents < installments) {
      throw new BusinessRuleError(
        "O valor da venda não permite esse número de parcelas.",
        ErrorCodes.INSTALLMENTS_EXCEED_TOTAL,
      );
    }

    // Ordem crescente de productVariantId: vendas simultâneas travam as variantes
    // sempre na mesma ordem (sem deadlock). Itens repetidos da mesma variante
    // reentram na trava já obtida por esta transação.
    const itemsInLockOrder = [...request.items].sort((a, b) =>
      a.productVariantId < b.productVariantId ? -1 : a.productVariantId > b.productVariantId ? 1 : 0,
    );
    for (const item of itemsInLockOrder) {
      try {
        await this.inventoryService.consumeStock({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          originId: sale.id,
          userId: request.sellerId,
        });
      } catch (error) {
        const name = saleItems.find((i) => i.variantId === item.productVariantId)?.variantName;
        throw name ? describeStockShortage(error, name) : error;
      }
    }

    const created = await this.saleRepository.create(sale);

    const plan = buildInstallments(sale.totalAmountCents, installments, firstDueDate);
    await this.financialService.createSaleReceivable({
      saleId: sale.id,
      customerId: sale.customerId,
      parcels: plan.map((p) => ({ amount: fromCents(p.amountCents), dueDate: p.dueDate })),
    });

    return created;
  }
}
