import { User } from "@auth/domain/entities/User";
import { UserRole } from "@auth/domain/enums/UserRole";
import { UserDTO } from "../dto/UserDTO";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
};

export class UserReadMapper {
  /** Linha do banco → DTO público (sem senha). */
  static toDTO(data: UserRow): UserDTO {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: UserRole[data.role as keyof typeof UserRole],
      active: data.active,
      createdAt: data.createdAt,
    };
  }

  static fromEntity(user: User): UserDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
    };
  }
}
