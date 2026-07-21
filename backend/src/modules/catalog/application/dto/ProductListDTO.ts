export interface ProductListDTO {
  id: string;
  name: string;
  description: string | null;

  brand: {
    id: string;
    name: string;
  };

  category: {
    id: string;
    name: string;
  };

  createdAt: Date;
}
