import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireRoles } from '../auth/rbac';
import { hashPassword } from '../auth/security';
import { audit } from '../audit/audit.service';

export async function companyRoutes(app: FastifyInstance) {
  app.get('/companies', async (req) => {
    requireRoles(req, ['PLATFORM_ADMIN']);
    return prisma.company.findMany({ orderBy: { createdAt: 'desc' }});
  });

  app.post('/companies', async (req) => {
    const actor = requireRoles(req, ['PLATFORM_ADMIN']);
    const body = z.object({ name: z.string().min(2), legalName: z.string().optional(), billingEmail: z.string().email().optional() }).parse(req.body);
    const company = await prisma.company.create({ data: body });
    await audit({companyId: company.id, actorUserId: actor.sub, action: 'CREATE', entityType: 'Company', entityId: company.id, metadata: body});
    return company;
  });

  app.post('/companies/:companyId/users', async (req) => {
    const actor = requireRoles(req, ['PLATFORM_ADMIN','COMPANY_ADMIN']);
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    if (actor.role !== 'PLATFORM_ADMIN' && actor.companyId !== params.companyId) throw new Error('Forbidden');
    const body = z.object({ email: z.string().email(), fullName: z.string().min(2), role: z.enum(['COMPANY_ADMIN','OPERATIONS_MANAGER','INSTALLER','CUSTOMER_VIEWER','FINANCE']), password: z.string().min(12) }).parse(req.body);
    const user = await prisma.user.create({ data: { companyId: params.companyId, email: body.email.toLowerCase(), fullName: body.fullName, role: body.role, passwordHash: await hashPassword(body.password) }});
    await audit({companyId: params.companyId, actorUserId: actor.sub, action: 'CREATE', entityType: 'User', entityId: user.id, metadata: {email: user.email, role: user.role}});
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  });
}