import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';

export const logAction = async (
  prisma: PrismaClient,
  action: string,
  entityType: string,
  entityId: number | null,
  userId: number,
  changes: unknown,
  ipAddress?: string,
  userAgent?: string
) => {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      userId,
      changes: changes as any,
      ipAddress,
      userAgent,
    },
  });
};

export const extractRequestInfo = (request: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} => {
  // IP address (considering proxy)
  const ip =
    request.headers['x-forwarded-for'] ||
    request.headers['x-real-ip'] ||
    request.socket?.remoteAddress ||
    request.connection?.remoteAddress ||
    null;
  const ipAddress = typeof ip === 'string' ? ip.split(',')[0] : undefined;

  const userAgent = request.headers['user-agent'] as string | undefined;

  return { ipAddress, userAgent };
};