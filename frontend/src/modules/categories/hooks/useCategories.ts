import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/shared/react-query/keys";

import { listCategories } from "../services/categoryService";

export const CATEGORY_OPTIONS_LIMIT = 100;

/** Categories for dropdowns (first 100, optionally filtered by name). */
export const useCategories = (search = "", limit = CATEGORY_OPTIONS_LIMIT) => {
  return useQuery({
    queryKey: [...queryKeys.categories, "options", search, limit],
    queryFn: () => listCategories({ page: 1, limit, search }),
    select: (result) => result.data,
  });
};
