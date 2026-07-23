import { UserRole } from "@auth/domain/enums/UserRole";

export interface UserDTO {
  id: string;

  name: string;

  email: string;

  role: UserRole;

  createdAt: Date;
}
