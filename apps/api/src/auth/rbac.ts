import { FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { forbidden, unauthorized } from '../common/errors';
import { verifyAccessToken, AccessClaims } from './security';

declare module 'fastify' { interface FastifyRequest { user?: AccessClaims } }

export function authenticate(req: FastifyRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  req.user = verifyAccessToken(header.slice(7));
  return req.user;
}

export function requireRoles(req: FastifyRequest, roles: UserRole[]) {
  const user = authenticate(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export function requireCompanyAccess(req: FastifyRequest, companyId: string) {
  const user = authenticate(req);
  if (user.role === 'PLATFORM_ADMIN') return user;
  if (!user.companyId || user.companyId !== companyId) throw forbidden();
  return user;
}