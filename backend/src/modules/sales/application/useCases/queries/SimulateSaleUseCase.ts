import { ErrorCodes, NotFoundError, BusinessRuleError, ValidationError } from "@shared/domain/errors";
import { UseCase } from "@shared/domain/UseCase";
import { fromCents, toCents } from "@shared/domain/money";
import { MAX_AMOUNT_CENTS } from "@shared/domain/limits";
import { CustomerService } from "@customer/application/services/CustomerService";
import { CatalogService } from "@catalog/application/services/CatalogService";
import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import { saleMargin } from "@pricing/domain/pricingMath";
import { checkoutCharge } from "@sales/domain/services/checkoutCharge";
import { IMMEDIATE_PAYMENT_CONDITIONS, PaymentCondition } from "@sales/domain/enums/PaymentCondition";
import { SaleCostReader } from "@sales/application/contracts/SaleCostReader";
import { SaleSimulationConditionDTO, SaleSimulationDTO } from "@sales/application/dto/SaleDTO";

export interface ISimulateSaleInput {
  customerId: string;
  items: { productVariantId: string; quantity: number }[];
  /** Quem pode ver lucro (`reports.profit`) recebe `margin` em cada condição. */
  includeMargin: boolean;
}

type Option = { condition: (typeof IMMEDIATE_PAYMENT_CONDITIONS)[number]; cardInstallments: number | null; passCardFee: boolean };

/** Dinheiro, PIX, débito (com e sem repasse) e crédito 1x..12x (com e sem repasse). */
const OPTIONS: Option[] = [
  { condition: PaymentCondition.CASH, cardInstallments: null, passCardFee: false },
  { condition: PaymentCondition.PIX, cardInstallments: null, passCardFee: false },
  { condition: PaymentCondition.DEBIT_CARD, cardInstallments: null, passCardFee: true },
  { condition: PaymentCondition.DEBIT_CARD, cardInstallments: null, passCardFee: false },
  ...Array.from({ length: 12 }, (_, i) => [true, false].map((passCardFee) => ({
    condition: PaymentCondition.CREDIT_CARD as const,
    cardInstallments: i + 1,
    passCardFee,
  }))).flat(),
];

/**
 * Simula o valor da venda em cada condição imediata (crediário: Task 8). Não grava nada
 * nem trava estoque. Margem = cobrado − taxa do cartão − custo médio atual − despesas.
 */
export class SimulateSaleUseCase implements UseCase<ISimulateSaleInput, SaleSimulationDTO> {
  constructor(
    private readonly customerService: CustomerService,
    private readonly catalogService: CatalogService,
    private readonly pricingSettings: Pick<PricingSettingsReader, "get">,
    private readonly costs: SaleCostReader,
  ) {}

  async execute(input: ISimulateSaleInput): Promise<SaleSimulationDTO> {
    const customer = await this.customerService.getCustomer(input.customerId);
    if (!customer) throw new NotFoundError("Cliente não encontrado.", ErrorCodes.CUSTOMER_NOT_FOUND);

    const ids = input.items.map((i) => i.productVariantId);
    const variants = new Map((await this.catalogService.getProductVariants(ids)).map((v) => [v.id, v]));
    const lines = input.items.map((item) => {
      const variant = variants.get(item.productVariantId);
      if (!variant) throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
      const unitPriceCents = toCents(variant.salePrice);
      if (unitPriceCents <= 0) {
        throw new BusinessRuleError("Variante sem preço de venda.", ErrorCodes.VARIANT_WITHOUT_PRICE);
      }
      return { variantId: variant.id, quantity: item.quantity, unitPriceCents };
    });
    const itemsTotalCents = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
    if (itemsTotalCents > MAX_AMOUNT_CENTS) {
      throw new ValidationError("Dados inválidos.", [{ field: "items", message: "O total da venda excede o máximo permitido." }]);
    }

    const settings = await this.pricingSettings.get();
    const costs = input.includeMargin ? await this.costs.averageCosts(ids) : new Map<string, number>();
    const costLines = lines.map((l) => ({
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      unitCost4: costs.get(l.variantId) ?? null,
    }));

    const conditions = OPTIONS.map((option): SaleSimulationConditionDTO => {
      const charge = checkoutCharge({
        itemsTotalCents,
        condition: option.condition,
        cardInstallments: option.cardInstallments,
        passCardFee: option.passCardFee,
        cardFees: settings.cardFees,
      });
      const dto: SaleSimulationConditionDTO = {
        condition: option.condition,
        cardInstallments: option.cardInstallments,
        passCardFee: option.passCardFee,
        total: fromCents(charge.totalCents),
      };
      if (input.includeMargin) {
        const margin = saleMargin({
          lines: costLines,
          chargedCents: charge.totalCents,
          expensesBps: settings.expensesBps,
          cardFeeBps: charge.cardFeeBps ?? 0,
        });
        dto.margin = margin.missingCost
          ? null
          : { amount: fromCents(margin.marginCents), percent: margin.marginBps / 100 };
      }
      return dto;
    });

    return { itemsTotal: fromCents(itemsTotalCents), conditions };
  }
}
