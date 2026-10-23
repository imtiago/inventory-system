import { NamedEntityPage } from '@/shared/components/NamedEntityPage';
import { queryKeys } from '@/shared/react-query/keys';

import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/categoryService';
import type { Category } from '../types';

export function CategoryListPage() {
  return (
    <NamedEntityPage<Category>
      singular="categoria"
      plural="categorias"
      queryKey={queryKeys.categories}
      existsCode="CATEGORY_ALREADY_EXISTS"
      list={listCategories}
      create={createCategory}
      update={updateCategory}
      remove={deleteCategory}
    />
  );
}
