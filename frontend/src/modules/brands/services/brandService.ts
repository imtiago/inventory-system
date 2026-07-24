import { api } from "@/shared/services/api";
import type { Brand } from "../types";

interface BrandResponse {
  data: Brand[];
}

export const getBrands = async (): Promise<Brand[]> => {
  const response = await api.get<BrandResponse>("/brands");

  return response.data.data;
};
