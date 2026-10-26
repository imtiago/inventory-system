import { NfeImportStatus } from "@nfe-import/domain/NfeImportStatus";

// Contrato HTTP (fixtures em frontend/src/test/fixtures/nfe/). Dinheiro em reais (2 casas),
// quantidades como número (até 4 casas), datas "YYYY-MM-DD".

export type NfeSuggestionSource = "MAPPING" | "BARCODE";

export interface NfeItemSuggestionDTO {
  source: NfeSuggestionSource;
  productVariantId: string;
  /** "<produto> — <variante> (<código da variante>)" */
  label: string;
  unitsPerPackage: number;
}

export interface NfeImportItemDTO {
  index: number;
  supplierCode: string;
  barcode: string | null;
  name: string;
  unit: string;
  quantity: number;
  /** Custo total do item / quantidade (arredondado ao centavo, meio para cima). */
  unitCost: number;
  /** Custo total do item na composição do vNF. */
  total: number;
  /** indTot da nota: false → o item não compõe o vNF (importação não suportada; o front avisa). */
  composesTotal: boolean;
  lots: { batchNumber: string; quantity: number; manufacturingDate: string | null; expirationDate: string | null }[];
  suggestion: NfeItemSuggestionDTO | null;
}

export interface NfeImportDTO {
  id: string;
  accessKey: string;
  status: NfeImportStatus;
  number: string;
  series: string;
  issueDate: string;
  totalAmount: number;
  /**
   * Conferência antes de confirmar: `total` = vNF; `orderTotal` = soma dos custos dos itens (o total do
   * pedido gerado); `difference` = total − orderTotal; `installmentsTotal` = soma das duplicatas (0 sem
   * duplicatas); `installmentsDifference` = installmentsTotal − orderTotal (0 sem duplicatas). Até R$ 0,05
   * a última parcela absorve; acima disso a confirmação recusa (INSTALLMENTS_TOTAL_MISMATCH).
   */
  totals: {
    total: number;
    orderTotal: number;
    difference: number;
    installmentsTotal: number;
    installmentsDifference: number;
  };
  purchaseId: string | null;
  createdAt: Date;
  supplier: { document: string; name: string; match: { id: string; name: string } | null };
  items: NfeImportItemDTO[];
  installments: { number: string | null; dueDate: string; amount: number }[];
}

export interface NfeImportSummaryDTO {
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
  createdAt: Date;
}
