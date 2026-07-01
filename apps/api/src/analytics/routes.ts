import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/companies/:companyId/analytics/overview', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const [devices, media, schedules, customers] = await Promise.all([
      prisma.device.groupBy({ by: ['status'], where: { companyId: params.companyId }, _count: true }),
      prisma.mediaAsset.count({ where: { companyId: params.companyId }}),
      prisma.schedule.count({ where: { companyId: params.companyId, status: 'ACTIVE' }}),
      prisma.customer.count({ where: { companyId: params.companyId }})
    ]);
    return { devices, mediaAssets: media, activeSchedules: schedules, customers };
  });
}
