export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MAX_BYTES_MESSAGE = `A senha deve ter no máximo ${PASSWORD_MAX_BYTES} bytes.`;

/** O servidor limita a senha em bytes UTF-8 (bcrypt): "é" conta 2. Devolve true ou a mensagem de erro. */
export function passwordBytesRule(value: string): true | string {
  return new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES || PASSWORD_MAX_BYTES_MESSAGE;
}
