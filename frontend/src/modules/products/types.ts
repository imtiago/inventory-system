import type { Brand } from "@/modules/brands/types";
import type { Category } from "@/modules/categories/types";
import type { Paginated } from "@/shared/types/pagination";

export type { Brand, Category };

/** Matches backend ProductDetailDTO (list items share the same shape). */
export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  brand: Brand;
  category: Category;
  variantsCount: number;
  createdAt?: string;
}

/** Matches backend VariantDTO. */
export interface ProductVariant {
  id: string;
  productId: string;
  code: string;
  name: string;
  barcode: string | null;
  salePrice: number;
  createdAt?: string;
}

export type ProductListResponse = Paginated<Product>;
export type ProductVariantListResponse = Paginated<ProductVariant>;

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  brandId?: string;
  categoryId?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  brandId?: string;
  categoryId?: string;
}
