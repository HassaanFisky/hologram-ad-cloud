import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function groupRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/groups', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ name: z.string().min(2), description: z.string().optional(), deviceIds: z.array(z.string().uuid()).default([]) }).parse(req.body);
    return prisma.deviceGroup.create({ data: { companyId: params.companyId, name: body.name, description: body.description, members: { create: body.deviceIds.map(deviceId => ({ deviceId })) }}, include: { members: true }});
  });
  app.get('/companies/:companyId/groups', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.deviceGroup.findMany({ where: { companyId: params.companyId }, include: { members: true }});
  });
}
