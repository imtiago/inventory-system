export interface ProductListDTO {
  id: string;

  code: string;

  name: string;

  brand: {
    id: string;
    name: string;
  };

  category: {
    id: string;
    name: string;
  };

  variantsCount: number;
}
