export interface Brand {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description?: string;

  brand: Brand;

  category: Category;

  variantsCount: number;
}
export interface ProductVariant {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  productId: string;
}

export interface ProductListResponse {
  data: Product[];

  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
