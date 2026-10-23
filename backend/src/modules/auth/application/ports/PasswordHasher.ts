export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  compare(plainPassword: string, passwordHash: string): Promise<boolean>;
  /**
   * Executa uma comparação com custo equivalente a `compare`, contra um hash
   * fixo que nunca confere. Usado quando o usuário não existe/está inativo,
   * para que o tempo de resposta não revele isso.
   */
  compareWithDummy(plainPassword: string): Promise<void>;
}
