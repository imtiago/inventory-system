export interface ProductListDTO {
  id: string;

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
