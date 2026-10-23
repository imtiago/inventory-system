export interface Brand {
  id: string;
  name: string;
  /** Present on brand list/detail responses; absent when nested in a product. */
  productsCount?: number;
}
