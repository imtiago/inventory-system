import { v4 as uuid } from "uuid";
import { UserRole } from "@prisma/client";

// src/modules/auth/domain/entities/User.ts
export class User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;

  constructor(props: {
    id?: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    createdAt?: Date;
  }) {
    this.id = props.id ?? uuid();
    this.name = props.name;
    this.email = props.email;
    this.password = props.password;
    this.role = props.role ?? UserRole.VENDEDOR; // define um padrão
    this.createdAt = props.createdAt ?? new Date();
  }
}
