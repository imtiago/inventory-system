import { api } from "@/shared/services/api";
import type { Category } from "../types";

interface CategoryResponse {
  data: Category[];
}

export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get<CategoryResponse>("/categories");

  return response.data.data;
};

export const getCategoryById = async (id: string): Promise<Category> => {
  const { data } = await api.get(`/categories/${id}`);
  return data;
};
