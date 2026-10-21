import { Product } from "@catalog/domain/entities/Product";

export class ProductHttpPresenter {
  static toHTTP(product: Product) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brandId: product.brandId,
      categoryId: product.categoryId,
      createdAt: product.createdAt,
    };
  }

  static toHTTPList(products: Product[]) {
    return products.map(ProductHttpPresenter.toHTTP);
  }
}
