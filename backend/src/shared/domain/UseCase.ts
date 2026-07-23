import { Prisma } from "@prisma/client";

export interface UseCase<Request = void, Response = void> {
  execute(
    request: Request,
    transaction?: Prisma.TransactionClient,
  ): Promise<Response>;
}
