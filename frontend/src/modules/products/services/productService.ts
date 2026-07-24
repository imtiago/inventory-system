import { api } from "@/shared/services/api";
import type { Product, ProductListResponse, ProductVariant } from "../types";

export async function getProducts(page = 1): Promise<ProductListResponse> {
  const response = await api.get("/products", {
    params: {
      page,
      limit: 10,
    },
  });

  return response.data;
}

export const createProduct = async (input: {
  name: string;
  sku: string;
  brandId?: string;
  categoryId?: string;
}) => {
  const { data } = await api.post("/products", input);
  return data;
};

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

  return response.data;
}
