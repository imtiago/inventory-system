import {
  BusinessRuleError,
  DomainError,
  ErrorCodes,
  ErrorDetails,
  InternalErrorCodes,
  InternalInvariantError,
  NotFoundError,
  ValidationError,
} from "@shared/domain/errors";
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
import { batchNumberCandidates } from "@nfe-import/domain/nfeLotNumbers";
import { NfeImportRepository } from "../../contracts/NfeImportRepository";
import { NfeLotLookup } from "../../contracts/NfeLotLookup";
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
    private readonly lots: NfeLotLookup,
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

    // 3. Variantes; erros do cadastro de um item levam "Item <n>: " (o front marca a linha).
    const resolved = [];
    for (const { item, request } of requests) {
      const productVariantId = await this.resolveVariant(item, request).catch((e: unknown) => {
        throw withItemPrefix(e, item.index);
      });
      resolved.push({ item, request, productVariantId, units: units.get(item.index)! });
    }
    // Mapeamentos em ordem de supplierCode: confirmações concorrentes do mesmo fornecedor travam
    // as linhas na mesma ordem (sem deadlock).
    for (const mapping of learnableMappings(resolved)) {
      await this.mappings.upsert({ supplierId: supplier.id, ...mapping });
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
    const created = await this.purchaseCreator.save(purchase, reconcileParcels(this.parcelsFor(document, purchase, input.installments), purchase.totalAmountCents));

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
    const batchNumbers = await this.deliveryBatchNumbers(purchase, lines);
    const segments = lines.map((line) => {
      const inLots = line.lots.reduce((sum, lot) => sum + lot.quantity, 0);
      const parts: IReceivePurchaseInput["items"] = line.lots.map((lot) => ({
        purchaseItemId: itemIdByVariant.get(line.productVariantId)!,
        quantity: lot.quantity,
        batchNumber: batchNumbers.get(line.productVariantId)!.get(lot.batchNumber),
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

  /**
   * Número de lote de cada lote da nota, por variante. O pedido é novo, então um lote da variante
   * com o mesmo número é de outra entrega/origem (o recebimento manual da 6A recusa com 409
   * BATCH_ALREADY_EXISTS): aqui a entrega vira o primeiro candidato livre de "<nLote>",
   * "<nLote>-<código do pedido>", "<nLote>-<código do pedido>-2"... — a nota nunca perde o lote
   * (e a validade). Mesmo nLote repetido na linha → mesmo lote.
   */
  private async deliveryBatchNumbers(purchase: Purchase, lines: NfePurchaseLine[]) {
    const byVariant = new Map<string, Map<string, string>>();
    for (const line of lines) {
      const assigned = new Map<string, string>();
      const used = new Set<string>();
      for (const lot of line.lots) {
        if (assigned.has(lot.batchNumber)) continue;
        let count = 8;
        let chosen: string | undefined;
        while (chosen === undefined) {
          const candidates = batchNumberCandidates(lot.batchNumber, purchase.code, count);
          const taken = new Set(await this.lots.findExistingBatchNumbers(line.productVariantId, candidates));
          chosen = candidates.find((c) => !taken.has(c) && !used.has(c));
          count *= 2;
        }
        used.add(chosen);
        assigned.set(lot.batchNumber, chosen);
      }
      byVariant.set(line.productVariantId, assigned);
    }
    return byVariant;
  }
}

/** Diferença máxima (centavos) entre a soma das parcelas e o total do pedido que ainda é absorvida pela última parcela. */
export const INSTALLMENTS_TOLERANCE_CENTS = 5;

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/**
 * Parcelas da nota (ou editadas) × total do pedido, que é a soma dos itens: até R$ 0,05 de
 * diferença a última parcela absorve; acima disso → 422 INSTALLMENTS_TOTAL_MISMATCH com os dois valores.
 */
export function reconcileParcels(parcels: PurchaseParcel[], totalCents: number): PurchaseParcel[] {
  // Duplicata sem valor (vDup ausente ou 0,00): o banco recusaria a parcela; avisa antes, com 422 claro.
  const bad = parcels.findIndex((p) => p.amountCents <= 0);
  if (bad >= 0) {
    throw new BusinessRuleError(
      `A parcela ${bad + 1} da nota está com valor zero ou ausente. Informe as parcelas manualmente.`,
      ErrorCodes.INSTALLMENT_AMOUNT_INVALID,
    );
  }
  const sum = parcels.reduce((acc, p) => acc + p.amountCents, 0);
  const diff = totalCents - sum;
  const last = parcels[parcels.length - 1];
  if (diff === 0 || (last && Math.abs(diff) <= INSTALLMENTS_TOLERANCE_CENTS && last.amountCents + diff > 0)) {
    return diff === 0 ? parcels : [...parcels.slice(0, -1), { ...last, amountCents: last.amountCents + diff }];
  }
  throw new BusinessRuleError(
    `A soma das parcelas (${brl(sum)}) difere do total do pedido (${brl(totalCents)}) em mais de ${brl(INSTALLMENTS_TOLERANCE_CENTS)}.`,
    ErrorCodes.INSTALLMENTS_TOTAL_MISMATCH,
  );
}

/**
 * Mapeamentos (código do fornecedor → variante/embalagem) a aprender: nunca para código vazio; código
 * repetido na nota só se todos os itens apontarem para a mesma variante e embalagem. Ordenados por
 * código (confirmações concorrentes do mesmo fornecedor travam as linhas na mesma ordem).
 */
function learnableMappings(
  resolved: { item: NfeItem; request: ConfirmItemInput; productVariantId: string }[],
): { supplierCode: string; productVariantId: string; unitsPerPackage: number }[] {
  const byCode = new Map<string, { productVariantId: string; unitsPerPackage: number }[]>();
  for (const { item, request, productVariantId } of resolved) {
    if (item.supplierCode.trim() === "") continue;
    const list = byCode.get(item.supplierCode) ?? [];
    list.push({ productVariantId, unitsPerPackage: unitsPerPackageOf(request) });
    byCode.set(item.supplierCode, list);
  }
  return [...byCode.entries()]
    .filter(([, list]) => list.every((m) => m.productVariantId === list[0].productVariantId && m.unitsPerPackage === list[0].unitsPerPackage))
    .map(([supplierCode, [first]]) => ({ supplierCode, ...first }))
    .sort((a, b) => (a.supplierCode < b.supplierCode ? -1 : a.supplierCode > b.supplierCode ? 1 : 0));
}

/**
 * Mesmo erro (classe, código, detalhes) com a mensagem "Item <n>: <mensagem>" — o formato que o
 * front procura (/\bitem\s+(\d+)/i) para mostrar o erro na linha do item.
 */
function withItemPrefix(error: unknown, index: number): unknown {
  if (!(error instanceof DomainError)) return error;
  const message = `Item ${index}: ${error.message}`;
  if (error instanceof ValidationError) return new ValidationError(message, error.errors, error.code);
  const Same = error.constructor as new (message: string, code: string, details?: ErrorDetails) => DomainError;
  return new Same(message, error.code, error.details);
}

function unitsPerPackageOf(request: ConfirmItemInput): number {
  return "link" in request ? request.link.unitsPerPackage : request.create.unitsPerPackage;
}
