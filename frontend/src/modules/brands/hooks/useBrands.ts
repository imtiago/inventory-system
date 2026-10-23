import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/shared/react-query/keys";

import { listBrands } from "../services/brandService";

export const BRAND_OPTIONS_LIMIT = 100;

/** Brands for dropdowns (first 100, optionally filtered by name). */
export const useBrands = (search = "") => {
  return useQuery({
    queryKey: [...queryKeys.brands, "options", search],
    queryFn: () => listBrands({ page: 1, limit: BRAND_OPTIONS_LIMIT, search }),
    select: (result) => result.data,
  });
};
