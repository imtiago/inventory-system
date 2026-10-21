export interface ITokenService {
  sign(payload: { sub: string; role: string }): Promise<string>;
}
