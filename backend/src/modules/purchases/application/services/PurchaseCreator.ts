import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { FinancialService } from "@finance/application/services/FinancialService";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { PurchaseItem } from "@purchases/domain/entities/PurchaseItem";
import { PurchaseOrigin } from "@purchases/domain/enums/PurchaseOrigin";
import { supplierNotFound } from "@purchases/domain/errors/supplierErrors";
import { PurchaseRepository } from "@purchases/domain/repositories/PurchaseRepository";
import { SupplierRepository } from "@purchases/domain/repositories/SupplierRepository";

const PURCHASE_CODE_PREFIX = "PC";

export interface PurchaseCreatorItem {
  productVariantId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  freightCents: number;
  taxCents: number;
}

export interface PurchaseCreatorInput {
  supplierId: string;
  /** "YYYY-MM-DD". */
  purchaseDate: string;
  notes: string | null;
  origin?: PurchaseOrigin;
  items: PurchaseCreatorItem[];
}

/** Parcela do contas a pagar: centavos inteiros, vencimento à meia-noite UTC. */
export interface PurchaseParcel {
  amountCents: number;
  dueDate: Date;
}

/**
 * Criação de pedido de compra em duas etapas, usada pelo POST /purchases e pela
 * confirmação de NF-e. Exige a transação do chamador (tudo grava no contexto ativo).
 * - `build`: valida fornecedor (404) e variantes (404), monta os itens (422 se total
 *   do item < 0), gera o código PC###### e o agregado (422 se total = 0). Não grava.
 * - `save`: soma das parcelas = total do pedido (senão 422 INSTALLMENTS_TOTAL_MISMATCH),
 *   grava o pedido e cria o contas a pagar com essas parcelas.
 */
export class PurchaseCreator {
  constructor(
    private readonly purchases: PurchaseRepository,
    private readonly suppliers: SupplierRepository,
    private readonly catalogService: CatalogService,
    private readonly financialService: FinancialService,
    private readonly numberGenerator: NumberGenerator,
  ) {}

  async build(input: PurchaseCreatorInput): Promise<Purchase> {
    const supplier = await this.suppliers.findById(input.supplierId);
    if (!supplier) throw supplierNotFound();

    const items: PurchaseItem[] = [];
    for (const item of input.items) {
      const variant = await this.catalogService.getProductVariant(item.productVariantId);
      if (!variant) throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
      items.push(new PurchaseItem({ ...item, productVariantId: variant.id }));
    }

    const code = await this.numberGenerator.generate(NumberRangeName.PURCHASE, PURCHASE_CODE_PREFIX);
    return Purchase.create({
      code,
      supplierId: supplier.id,
      purchaseDate: input.purchaseDate,
      notes: input.notes,
      origin: input.origin,
      items,
    });
  }

  async save(purchase: Purchase, parcels: PurchaseParcel[]): Promise<Purchase> {
    const parcelsTotal = parcels.reduce((sum, p) => sum + p.amountCents, 0);
    if (parcels.length === 0 || parcelsTotal !== purchase.totalAmountCents) {
      throw new BusinessRuleError(
        "A soma das parcelas difere do total do pedido.",
        ErrorCodes.INSTALLMENTS_TOTAL_MISMATCH,
      );
    }

    const created = await this.purchases.create(purchase);
    await this.financialService.createPurchasePayable({
      purchaseId: purchase.id,
      supplierId: purchase.supplierId,
      parcels: parcels.map((p) => ({ amountCents: p.amountCents, dueDate: p.dueDate })),
    });
    return created;
  }
}
