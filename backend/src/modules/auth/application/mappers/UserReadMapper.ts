// application/mappers/StockMovementReadMapper.ts

import { UserRole } from "@auth/domain/enums/UserRole";
import { UserDTO } from "../dto/UserDTO";

export class UserReadMapper {
  static toDTO(data: any): UserDTO {
    return {
      id: data.id,
      name: data.name,
      role: UserRole[data.role],
      createdAt: data.createdAt,
      email: data.email,
    };
  }
}
