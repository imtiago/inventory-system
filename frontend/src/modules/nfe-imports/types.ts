import type { Paginated } from '@/shared/types/pagination';

export type NfeImportStatus = 'DRAFT' | 'CONFIRMED';

export const NFE_STATUS_LABELS: Record<NfeImportStatus, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmada',
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
  purchaseId: string | null;
  createdAt: string;
  supplier: { document: string; name: string; match: { id: string; name: string } | null };
  items: INfeItem[];
  installments: { number: string; dueDate: string; amount: number }[];
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
  installments: { dueDate: string; amount: number }[];
  receive: boolean;
}

export interface IConfirmNfeResult {
  importId: string;
  purchaseId: string;
}
