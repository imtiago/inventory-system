export interface ICrudRepository<TEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  create(entity: TEntity): Promise<TEntity>;
  update(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}
