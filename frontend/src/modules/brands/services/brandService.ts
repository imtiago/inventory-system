import { api } from "@/shared/services/api";
import type { ListParams, Paginated } from "@/shared/types/pagination";
import type { Brand } from "../types";

export interface SaveBrandInput {
  name: string;
}

export async function listBrands(params: ListParams = {}): Promise<Paginated<Brand>> {
  const { search, ...rest } = params;
  const response = await api.get<Paginated<Brand>>("/brands", {
    params: { ...rest, ...(search?.trim() ? { search: search.trim() } : {}) },
  });

  return response.data;
}

export async function getBrand(id: string): Promise<Brand> {
  const response = await api.get<{ data: Brand }>(`/brands/${id}`);

  return response.data.data;
}

export async function createBrand(input: SaveBrandInput): Promise<Brand> {
  const response = await api.post<{ data: Brand }>("/brands", input);

  return response.data.data;
}

export async function updateBrand(id: string, input: SaveBrandInput): Promise<Brand> {
  const response = await api.put<{ data: Brand }>(`/brands/${id}`, input);

  return response.data.data;
}

export async function deleteBrand(id: string): Promise<void> {
  await api.delete(`/brands/${id}`);
}
