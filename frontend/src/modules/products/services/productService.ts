import { api } from "@/shared/services/api";
import type { ProductFormData } from "../components/ProductForm";
import type {
  Product,
  ProductListParams,
  ProductListResponse,
  ProductVariantListResponse,
  UpdateProductInput,
} from "../types";

export async function getProducts(params: ProductListParams = {}): Promise<ProductListResponse> {
  const { search, brandId, categoryId, ...rest } = params;

  const response = await api.get<ProductListResponse>("/products", {
    params: {
      ...rest,
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...(brandId ? { brandId } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
  });

  return response.data;
}

export async function getProductById(id: string): Promise<Product> {
  const response = await api.get<{ data: Product }>(`/products/${id}`);

  return response.data.data;
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  const response = await api.post<{ data: Product }>("/products", data);

  return response.data.data;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const response = await api.put<{ data: Product }>(`/products/${id}`, input);

  return response.data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}

export async function getProductVariants(
  productId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ProductVariantListResponse> {
  const response = await api.get<ProductVariantListResponse>(`/products/${productId}/variants`, { params });

  return response.data;
}
