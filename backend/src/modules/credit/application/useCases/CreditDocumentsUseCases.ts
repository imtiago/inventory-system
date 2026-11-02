import { BusinessRuleError, NotFoundError } from "@shared/domain/errors";
import { ErrorCodes } from "@shared/domain/errors/errorCodes";
import { buildCarneContent, buildReceiptContent } from "@credit/domain/carneContent";
import type { CreditDocumentsReader } from "@credit/application/contracts/CreditDocumentsReader";
import type { StoreSettingsRepository } from "@credit/application/contracts/StoreSettingsRepository";
import type { CreditDocumentsPdfService } from "@credit/infrastructure/pdf/CreditDocumentsPdfService";

export interface GeneratedPdf {
  pdf: Buffer;
  filename: string;
}

async function requireStore(store: StoreSettingsRepository, what: "o carnê" | "o recibo") {
  const found = await store.find();
  if (!found) {
    throw new BusinessRuleError(`Preencha os dados da loja antes de emitir ${what}.`, ErrorCodes.STORE_SETTINGS_MISSING);
  }
  return found;
}

export class GenerateCarneUseCase {
  constructor(
    private readonly reader: CreditDocumentsReader,
    private readonly store: StoreSettingsRepository,
    private readonly pdf: CreditDocumentsPdfService,
  ) {}

  async execute(saleId: string): Promise<GeneratedPdf> {
    const read = await this.reader.carneSale(saleId);
    if (!read) throw new NotFoundError("Venda não encontrada.", ErrorCodes.SALE_NOT_FOUND);
    if (read.kind === "NOT_CREDIARIO") {
      throw new BusinessRuleError("Só vendas no crediário têm carnê.", ErrorCodes.NOT_A_CREDIARIO_SALE);
    }
    if (read.kind === "CANCELED") {
      throw new BusinessRuleError("Venda cancelada não tem carnê.", ErrorCodes.SALE_ALREADY_CANCELED);
    }
    const store = await requireStore(this.store, "o carnê");
    // Multa/juros/carência: os gravados na venda (`SaleFinancing`), lidos pelo reader.
    const content = buildCarneContent({ ...read.input, store });
    return { pdf: await this.pdf.carne(content), filename: `carne-${read.input.sale.code}.pdf` };
  }
}

export class GenerateReceiptUseCase {
  constructor(
    private readonly reader: CreditDocumentsReader,
    private readonly store: StoreSettingsRepository,
    private readonly pdf: CreditDocumentsPdfService,
  ) {}

  async execute(paymentId: string): Promise<GeneratedPdf> {
    const read = await this.reader.receiptPayment(paymentId);
    if (!read) throw new NotFoundError("Pagamento não encontrado.", ErrorCodes.PAYMENT_NOT_FOUND);
    if (read.kind === "REVERSED") {
      throw new BusinessRuleError("Pagamento estornado não tem recibo.", ErrorCodes.PAYMENT_ALREADY_REVERSED);
    }
    const store = await requireStore(this.store, "o recibo");
    const content = buildReceiptContent({ ...read.input, store });
    return { pdf: await this.pdf.receipt(content), filename: `recibo-${read.input.payment.code}.pdf` };
  }
}
