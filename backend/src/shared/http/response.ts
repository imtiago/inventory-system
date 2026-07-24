// shared/http/response.ts

import { PaginatedResult } from "../application/dtos/PaginatedResult";

export class HttpResponse {
  static ok<T>(data: T) {
    return {
      data,
    };
  }

  static created<T>(data: T) {
    return {
      data,
    };
  }

  static paginated<T>(result: PaginatedResult<T>) {
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }
}
