import { api } from "@/shared/services/api";
import type { Product } from "../types";

export const getProducts = async (search = "") => {
  const { data } = await api.get(`/products?search=${search}`);
  return data.map((p: Product) => ({
    ...p,
    stock: p.stock ?? 0, // fallback se não houver estoque
  }));
};

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

export const getProductById = async (id: string): Promise<Product> => {
  const { data } = await api.get(`/products/${id}`);
  return data;
};

export const updateProduct = async (id: string, input: any) => {
  const { data } = await api.put(`/products/${id}`, input);
  return data;
};
