import { ProductReadRepository } from "../contracts/ProductReadRepository";
import { ProductListDTO } from "../dto/ProductListDTO";
interface ListProductsRequest {
  page: number;
  limit: number;
}

interface ListProductsResponse {
  data: ProductListDTO[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
export class ListProductsUseCase {
  constructor(private readonly repository: ProductReadRepository) {}
  async execute({
    page,
    limit,
  }: ListProductsRequest): Promise<ListProductsResponse> {
    const result = await this.repository.list({
      page,
      limit,
    });
    return {
      data: result.data,

      pagination: {
        page,
        limit,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }
}
