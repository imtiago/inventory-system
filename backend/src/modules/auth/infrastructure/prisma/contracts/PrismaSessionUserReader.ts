import { SessionUser, SessionUserReader } from "@auth/application/ports/SessionUserReader";
import { UserRole } from "@auth/domain/enums/UserRole";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaSessionUserReader implements SessionUserReader {
  async findById(id: string): Promise<SessionUser | null> {
    const user = await getDb().user.findUnique({
      where: { id },
      select: { id: true, role: true, active: true, passwordChangedAt: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      role: user.role as UserRole,
      active: user.active,
      passwordChangedAt: user.passwordChangedAt,
    };
  }
}
