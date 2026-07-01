import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function customerRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/customers', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ name: z.string().min(2), contactEmail: z.string().email().optional(), contactPhone: z.string().optional() }).parse(req.body);
    return prisma.customer.create({ data: { ...body, companyId: params.companyId }});
  });
  app.get('/companies/:companyId/customers', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.customer.findMany({ where: { companyId: params.companyId }, orderBy: { createdAt: 'desc' }});
  });
}
