export interface UseCase<Request = void, Response = void> {
  execute(request: Request): Promise<Response>;
}
