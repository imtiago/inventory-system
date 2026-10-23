import { ErrorCodes, InternalErrorCodes, InternalInvariantError, NotFoundError, ValidationError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { CatalogWriteService } from "@catalog/application/services/CatalogWriteService";
import { PurchaseCreator, PurchaseParcel } from "@purchases/application/services/PurchaseCreator";
import { ReceivePurchaseUseCase } from "@purchases/application/useCases/commands/ReceivePurchaseUseCase";
import { IReceivePurchaseInput } from "@purchases/application/dto/PurchaseDTO";
import { Purchase } from "@purchases/domain/entities/Purchase";
import { Supplier } from "@purchases/domain/entities/Supplier";
import { PurchaseOrigin } from "@purchases/domain/enums/PurchaseOrigin";
import { supplierNotFound } from "@purchases/domain/errors/supplierErrors";
import { SupplierRepository } from "@purchases/domain/repositories/SupplierRepository";
import { NfeDocument, NfeItem } from "@nfe-import/domain/NfeDocument";
import {
  nfeImportConfirmed,
  nfeImportNotFound,
  supplierDocumentMismatch,
} from "@nfe-import/domain/errors/nfeImportErrors";
import { NfeItemUnits, nfeItemUnits, NfePurchaseLine, toPurchaseLines } from "@nfe-import/domain/nfePurchaseLines";
import { NfeImportRepository } from "../../contracts/NfeImportRepository";
import { SupplierProductMappingRepository } from "../../contracts/SupplierProductMappingRepository";

export type ConfirmSupplierInput =
  | { id: string }
  | { create: { name: string; email: string | null; phone: string | null } };

export type ConfirmItemInput =
  | { index: number; link: { productVariantId: string; unitsPerPackage: number } }
  | {
      index: number;
      create: {
        productId?: string;
        newProduct?: { name: string; brandId: string; categoryId: string; description: string | null };
        variantName: string;
        /** undefined → código de barras da nota; null → sem código de barras. */
        barcode?: string | null;
        salePrice: number;
        unitsPerPackage: number;
      };
    };

export interface ConfirmNfeImportInput {
  id: string;
  /** Usuário autenticado (confirmedById e movimentações de estoque). */
  userId: string;
  supplier: ConfirmSupplierInput;
  items: ConfirmItemInput[];
  /** Ausente → duplicatas da nota; sem duplicatas → parcela única na emissão. */
  installments?: { dueDate: string; amountCents: number }[];
  receive: boolean;
}

export interface ConfirmNfeImportResult {
  importId: string;
  purchaseId: string;
}

const invalid = (field: string, message: string) => new ValidationError("Dados inválidos.", [{ field, message }]);
const utcDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Confirma o rascunho numa transação só, na ordem da spec:
 * 1. trava o rascunho (FOR UPDATE; não DRAFT → 409 NFE_IMPORT_CONFIRMED) — validações puras do
 *    corpo contra a nota (itens, parcelas, unidades inteiras, indTot) logo em seguida, antes de gravar;
 * 2. fornecedor (id com o documento da nota, ou cria/usa o existente pelo documento);
 * 3. variantes (vincula, ou cria produto+variante / variante) e grava o mapeamento;
 * 4. unidades e soma por variante; 5. pedido XML + contas a pagar;
 * 6. entrada no estoque com os lotes da nota (opcional); 7. rascunho → CONFIRMED.
 * Qualquer erro desfaz tudo.
 */
export class ConfirmNfeImportUseCase extends TransactionalUseCase<ConfirmNfeImportInput, ConfirmNfeImportResult> {
  constructor(
    private readonly imports: NfeImportRepository,
    private readonly suppliers: SupplierRepository,
    private readonly catalog: CatalogService,
    private readonly catalogWrite: CatalogWriteService,
    private readonly mappings: SupplierProductMappingRepository,
    private readonly purchaseCreator: PurchaseCreator,
    private readonly receivePurchase: Pick<ReceivePurchaseUseCase, "execute">,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: ConfirmNfeImportInput): Promise<ConfirmNfeImportResult> {
    // 1. Trava o rascunho: duas confirmações simultâneas → a segunda espera e vê CONFIRMED.
    const locked = await this.imports.lockById(input.id);
    if (!locked) throw nfeImportNotFound();
    if (locked.status !== "DRAFT") throw nfeImportConfirmed();
    const document = await this.imports.findDocument(input.id);
    if (!document) throw nfeImportNotFound();

    const requests = this.matchItems(document, input.items);
    this.validateInstallments(document, input.installments);
    const units = new Map<number, NfeItemUnits>(
      requests.map(({ item, request }) => [item.index, nfeItemUnits(item, unitsPerPackageOf(request))]),
    );

    // 2. Fornecedor.
    const supplier = await this.resolveSupplier(document, input.supplier);

    // 3. Variantes e mapeamentos.
    const resolved = [];
    for (const { item, request } of requests) {
      const productVariantId = await this.resolveVariant(item, request);
      await this.mappings.upsert({
        supplierId: supplier.id,
        supplierCode: item.supplierCode,
        productVariantId,
        unitsPerPackage: unitsPerPackageOf(request),
      });
      resolved.push({ item, productVariantId, units: units.get(item.index)! });
    }

    // 4. Unidades somadas por variante; total de cada item = custo da nota.
    const lines = toPurchaseLines(resolved);

    // 5. Pedido + contas a pagar.
    const purchase = await this.purchaseCreator.build({
      supplierId: supplier.id,
      purchaseDate: document.issueDate,
      notes: `NF-e ${document.number}/${document.series}`,
      origin: PurchaseOrigin.XML,
      items: lines.map(({ productVariantId, quantity, unitPriceCents, discountCents, freightCents, taxCents }) => ({
        productVariantId,
        quantity,
        unitPriceCents,
        discountCents,
        freightCents,
        taxCents,
      })),
    });
    const costTotal = lines.reduce((sum, line) => sum + line.costCents, 0);
    if (purchase.totalAmountCents !== costTotal) {
      throw new InternalInvariantError("Total do pedido difere do custo da nota.", InternalErrorCodes.PURCHASE_ITEM_INVALID);
    }
    const created = await this.purchaseCreator.save(purchase, this.parcelsFor(document, purchase, input.installments));

    // 6. Entrada no estoque.
    if (input.receive) await this.receiveAll(created, lines, input.userId);

    // 7. Rascunho confirmado.
    await this.imports.markConfirmed({ id: input.id, purchaseId: created.id, confirmedById: input.userId });
    return { importId: input.id, purchaseId: created.id };
  }

  /** Cada item da nota exatamente uma vez (400 se faltar, repetir ou não existir). */
  private matchItems(document: NfeDocument, items: ConfirmItemInput[]) {
    const byIndex = new Map(items.map((request) => [request.index, request]));
    if (byIndex.size !== items.length) throw invalid("items", "Item da nota repetido.");
    const unknown = items.find((request) => !document.items.some((item) => item.index === request.index));
    if (unknown) throw invalid("items", `A nota não tem o item ${unknown.index}.`);
    const missing = document.items.find((item) => !byIndex.has(item.index));
    if (missing) throw invalid("items", `Informe o item ${missing.index} da nota.`);
    return [...document.items]
      .sort((a, b) => a.index - b.index)
      .map((item) => ({ item, request: byIndex.get(item.index)! }));
  }

  private validateInstallments(document: NfeDocument, installments: ConfirmNfeImportInput["installments"]) {
    // "YYYY-MM-DD": comparação lexicográfica = cronológica.
    if (installments?.some((p) => p.dueDate < document.issueDate)) {
      throw invalid("installments", "O vencimento não pode ser anterior à data de emissão da nota.");
    }
  }

  private async resolveSupplier(document: NfeDocument, request: ConfirmSupplierInput): Promise<Supplier> {
    if ("id" in request) {
      const supplier = await this.suppliers.findById(request.id);
      if (!supplier) throw supplierNotFound();
      if (supplier.document !== document.supplier.document) throw supplierDocumentMismatch();
      return supplier;
    }
    return this.suppliers.createOrGetByDocument(
      new Supplier({
        name: request.create.name,
        document: document.supplier.document,
        email: request.create.email,
        phone: request.create.phone,
      }),
    );
  }

  private async resolveVariant(item: NfeItem, request: ConfirmItemInput): Promise<string> {
    if ("link" in request) {
      const variant = await this.catalog.getProductVariant(request.link.productVariantId);
      if (!variant) throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
      return variant.id;
    }
    const { create } = request;
    const variant = {
      name: create.variantName,
      barcode: create.barcode === undefined ? item.barcode : create.barcode,
      salePrice: create.salePrice,
    };
    if (create.newProduct) {
      return (await this.catalogWrite.createProductWithVariant({ ...create.newProduct, variant })).productVariantId;
    }
    return (await this.catalogWrite.createVariant({ productId: create.productId!, ...variant })).productVariantId;
  }

  /** Parcelas confirmadas (centavos); a soma é conferida com o total do pedido em PurchaseCreator.save (422). */
  private parcelsFor(
    document: NfeDocument,
    purchase: Purchase,
    installments: ConfirmNfeImportInput["installments"],
  ): PurchaseParcel[] {
    if (installments) return installments.map((p) => ({ amountCents: p.amountCents, dueDate: utcDate(p.dueDate) }));
    if (document.installments.length > 0) {
      return document.installments.map((p) => ({ amountCents: p.amount, dueDate: utcDate(p.dueDate) }));
    }
    return [{ amountCents: purchase.totalAmountCents, dueDate: utcDate(document.issueDate) }];
  }

  /**
   * Recebe tudo pelo caso de uso da 6A. Um recebimento aceita uma linha por item do pedido,
   * então cada rodada leva o k-ésimo segmento (lote da nota, ou o restante sem lote) de cada item.
   */
  private async receiveAll(purchase: Purchase, lines: NfePurchaseLine[], userId: string) {
    const itemIdByVariant = new Map(purchase.items.map((item) => [item.productVariantId, item.id]));
    const segments = lines.map((line) => {
      const inLots = line.lots.reduce((sum, lot) => sum + lot.quantity, 0);
      const parts: IReceivePurchaseInput["items"] = line.lots.map((lot) => ({
        purchaseItemId: itemIdByVariant.get(line.productVariantId)!,
        quantity: lot.quantity,
        batchNumber: lot.batchNumber,
        manufacturingDate: lot.manufacturingDate ?? undefined,
        expirationDate: lot.expirationDate ?? undefined,
      }));
      if (line.quantity > inLots) {
        parts.push({ purchaseItemId: itemIdByVariant.get(line.productVariantId)!, quantity: line.quantity - inLots });
      }
      return parts;
    });
    const rounds = Math.max(...segments.map((parts) => parts.length));
    for (let round = 0; round < rounds; round++) {
      const items = segments.flatMap((parts) => (parts[round] ? [parts[round]] : []));
      await this.receivePurchase.execute({ id: purchase.id, items, userId });
    }
  }
}

function unitsPerPackageOf(request: ConfirmItemInput): number {
  return "link" in request ? request.link.unitsPerPackage : request.create.unitsPerPackage;
}
