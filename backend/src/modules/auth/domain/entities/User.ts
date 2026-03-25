import { UserRole } from "@prisma/client";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  createdAt: Date;
}
