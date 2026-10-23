import { api } from "@/shared/services/api";
import type { ListParams, Paginated } from "@/shared/types/pagination";
import type { Category } from "../types";

export interface SaveCategoryInput {
  name: string;
}

export async function listCategories(params: ListParams = {}): Promise<Paginated<Category>> {
  const { search, ...rest } = params;
  const response = await api.get<Paginated<Category>>("/categories", {
    params: { ...rest, ...(search?.trim() ? { search: search.trim() } : {}) },
  });

  return response.data;
}

export async function getCategory(id: string): Promise<Category> {
  const response = await api.get<{ data: Category }>(`/categories/${id}`);

  return response.data.data;
}

export async function createCategory(input: SaveCategoryInput): Promise<Category> {
  const response = await api.post<{ data: Category }>("/categories", input);

  return response.data.data;
}

export async function updateCategory(id: string, input: SaveCategoryInput): Promise<Category> {
  const response = await api.put<{ data: Category }>(`/categories/${id}`, input);

  return response.data.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}
