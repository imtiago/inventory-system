export interface CategoryDTO {
  id: string;
  name: string;
  productsCount: number;
  /** Interno: a camada HTTP troca por `targetMarginPercent` (só `pricing.manage`) e remove. */
  targetMarginBps?: number | null;
}

export interface ICreateCategoryInput {
  name: string;
}

export interface IUpdateCategoryInput {
  id: string;
  name: string;
}

export interface IDeleteCategoryInput {
  id: string;
}
