import { api } from "@/shared/services/api";

export const getProducts = async (search = "") => {
  const { data } = await api.get(`/products?search=${search}`);
  return data;
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

export const getProductById = async (id: string) => {
  const { data } = await api.get(`/products/${id}`);
  return data;
};

export const updateProduct = async (id: string, input: any) => {
  const { data } = await api.put(`/products/${id}`, input);
  return data;
};
