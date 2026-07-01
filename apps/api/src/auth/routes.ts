import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { AppError } from '../common/errors';
import { hashPassword, signAccessToken, signRefreshToken, verifyPassword } from './security';
import { audit } from '../audit/audit.service';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register-first-admin', async (req) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(12), fullName: z.string().min(2), companyName: z.string().min(2) }).parse(req.body);
    const existing = await prisma.user.count();
    if (existing > 0) throw new AppError(409, 'Initial admin already exists', 'INITIAL_ADMIN_EXISTS');
    const company = await prisma.company.create({ data: { name: body.companyName }});
    const user = await prisma.user.create({ data: { companyId: company.id, email: body.email.toLowerCase(), fullName: body.fullName, role: 'PLATFORM_ADMIN', passwordHash: await hashPassword(body.password) }});
    await audit({companyId: company.id, actorUserId: user.id, action: 'CREATE', entityType: 'User', entityId: user.id, metadata: {bootstrap: true}});
    return { accessToken: signAccessToken({ sub: user.id, companyId: user.companyId, role: user.role, email: user.email }), refreshToken: signRefreshToken(user.id) };
  });

  app.post('/auth/login', async (req) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }});
    if (!user || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    const refreshToken = signRefreshToken(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), refreshTokenHash: await hashPassword(refreshToken) }});
    await audit({companyId: user.companyId, actorUserId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'], metadata: {}});
    return { accessToken: signAccessToken({ sub: user.id, companyId: user.companyId, role: user.role, email: user.email }), refreshToken };
  });
}
