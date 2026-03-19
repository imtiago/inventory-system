import { api } from "@/shared/services/api";
import type { Category } from "../types";

export const getCategories = async (search = ""): Promise<Category[]> => {
  const { data } = await api.get(`/categories?search=${search}`);
  return data;
};

export const getCategoryById = async (id: string): Promise<Category> => {
  const { data } = await api.get(`/categories/${id}`);
  return data;
};
