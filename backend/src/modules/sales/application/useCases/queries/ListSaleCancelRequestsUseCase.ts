import { PaginationParams } from "@shared/application/pagination";
import { ApprovalRequestStatus } from "@sales/domain/entities/SaleCancelRequest";
import { SaleCancelRequestRepository } from "@sales/domain/repositories/SaleCancelRequestRepository";

export class ListSaleCancelRequestsUseCase {
  constructor(private readonly requests: SaleCancelRequestRepository) {}

  execute({ page, limit }: PaginationParams, filter: { status?: ApprovalRequestStatus } = {}) {
    return this.requests.list({ page, limit }, filter);
  }

  countPending() {
    return this.requests.countPending();
  }
}
