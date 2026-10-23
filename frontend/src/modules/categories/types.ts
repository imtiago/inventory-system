export interface Category {
  id: string;
  name: string;
  /** Present on category list/detail responses; absent when nested in a product. */
  productsCount?: number;
}
