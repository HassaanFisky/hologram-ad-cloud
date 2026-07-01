import { AuditAction } from '@prisma/client';
import { prisma } from '../common/prisma';

export async function audit(input: {companyId?: string | null; actorUserId?: string | null; action: AuditAction; entityType: string; entityId?: string | null; ipAddress?: string; userAgent?: string; metadata?: unknown}) {
  await prisma.auditLog.create({ data: {
    companyId: input.companyId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: (input.metadata ?? {}) as object
  }});
}
