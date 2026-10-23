import { NamedEntityPage } from '@/shared/components/NamedEntityPage';
import { queryKeys } from '@/shared/react-query/keys';

import { createBrand, deleteBrand, listBrands, updateBrand } from '../services/brandService';
import type { Brand } from '../types';

export function BrandListPage() {
  return (
    <NamedEntityPage<Brand>
      singular="marca"
      plural="marcas"
      queryKey={queryKeys.brands}
      existsCode="BRAND_ALREADY_EXISTS"
      list={listBrands}
      create={createBrand}
      update={updateBrand}
      remove={deleteBrand}
    />
  );
}
