export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // hash da senha
  role?: "admin" | "vendedor" | "estoquista";
  createdAt: Date;
}
