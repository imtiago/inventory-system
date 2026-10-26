import type { Paginated } from '@/shared/types/pagination';

/** REVERTED: the import was undone (stock reversed, payable and order canceled); re-uploading the XML reopens it as DRAFT. */
export type NfeImportStatus = 'DRAFT' | 'CONFIRMED' | 'REVERTED';

export const NFE_STATUS_LABELS: Record<NfeImportStatus, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmada',
  REVERTED: 'Desfeita',
};

/** GET /nfe-imports row (NfeImportSummaryDTO). Money in reais, dates "YYYY-MM-DD". */
export interface INfeImportSummary {
  id: string;
  accessKey: string;
  status: NfeImportStatus;
  number: string;
  series: string;
  issueDate: string;
  totalAmount: number;
  supplier: { document: string; name: string };
  itemsCount: number;
  purchaseId: string | null;
  createdAt: string;
}

export type NfeImportListResponse = Paginated<INfeImportSummary>;

export interface INfeSuggestion {
  source: 'MAPPING' | 'BARCODE';
  productVariantId: string;
  label: string;
  unitsPerPackage: number;
}

export interface INfeItem {
  index: number;
  supplierCode: string;
  barcode: string | null;
  name: string;
  unit: string;
  /** Quantity as in the note, up to 4 decimals. */
  quantity: number;
  unitCost: number;
  /** Item cost in the vNF composition, reais. */
  total: number;
  /** indTot of the note; false: the item is outside vNF and the import is not supported. */
  composesTotal: boolean;
  lots: { batchNumber: string; quantity: number; manufacturingDate: string | null; expirationDate: string | null }[];
  suggestion: INfeSuggestion | null;
}

/** GET /nfe-imports/:id (NfeImportDTO). */
export interface INfeImport {
  id: string;
  accessKey: string;
  status: NfeImportStatus;
  number: string;
  series: string;
  issueDate: string;
  totalAmount: number;
  /**
   * Totals check, reais: total = vNF; orderTotal = sum of the items' costs (the order total);
   * difference = total - orderTotal; installmentsTotal = sum of the note's duplicatas (0 when none);
   * installmentsDifference = installmentsTotal - orderTotal (0 when none).
   */
  totals: {
    total: number;
    orderTotal: number;
    difference: number;
    installmentsTotal: number;
    installmentsDifference: number;
  };
  purchaseId: string | null;
  createdAt: string;
  supplier: { document: string; name: string; match: { id: string; name: string } | null };
  items: INfeItem[];
  /** number: the note's nDup; null when the note has none. */
  installments: { number: string | null; dueDate: string; amount: number }[];
}

export interface IConfirmNfeItem {
  index: number;
  link?: { productVariantId: string; unitsPerPackage: number };
  create?: {
    productId?: string;
    newProduct?: { name: string; brandId: string; categoryId: string };
    variantName: string;
    /** Omitted: the note's barcode. null: no barcode. */
    barcode?: string | null;
    salePrice: number;
    unitsPerPackage: number;
  };
}

export interface IConfirmNfeDTO {
  supplier: { id: string } | { create: { name: string; email?: string; phone?: string } };
  items: IConfirmNfeItem[];
  /** Omitted when the order total is zero (bonificação): no installments, no payable. */
  installments?: { dueDate: string; amount: number }[];
  receive: boolean;
}

export interface IConfirmNfeResult {
  importId: string;
  purchaseId: string;
}
