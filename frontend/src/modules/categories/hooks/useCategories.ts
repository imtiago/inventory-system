import { useQuery } from "@tanstack/react-query";
import { getCategories } from "../services/categoryService";

export const useCategories = (search: string = "") => {
  return useQuery({
    queryKey: ["categories", search],
    queryFn: () => getCategories(search),
  });
};
