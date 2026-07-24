import { api } from "@/shared/services/api";
import type { Product, ProductListResponse, ProductVariant } from "../types";
import type { ProductFormData } from "../components/ProductForm";

export interface CreateVariantDTO {
  name: string;
  barcode?: string;
}

export async function createVariant(productId: string, data: CreateVariantDTO) {
  const response = await api.post(`/products/${productId}/variants`, data);

  return response.data.data;
}

export async function getProducts(page = 1): Promise<ProductListResponse> {
  const response = await api.get("/products", {
    params: {
      page,
      limit: 10,
    },
  });

  return response.data;
}

export async function createProduct(data: ProductFormData) {
  const response = await api.post("/products", data);

  return response.data.data;
}

export const deleteProduct = async (id: string) => {
  await api.delete(`/products/${id}`);
};

export async function getProductById(id: string): Promise<Product> {
  const response = await api.get(`/products/${id}`);

  return response.data;
}
export const updateProduct = async (id: string, input: any) => {
  const { data } = await api.put(`/products/${id}`, input);
  return data;
};

export async function getProductVariants(
  productId: string,
): Promise<ProductVariant[]> {
  const response = await api.get(`/products/${productId}/variants`);

  return response.data.data; // se a API retorna { data: [...] }
}
