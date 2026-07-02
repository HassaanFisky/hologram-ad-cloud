import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireRoles } from '../auth/rbac';

export async function otaRoutes(app: FastifyInstance) {
  app.post('/ota/releases', async (req) => {
    requireRoles(req, ['PLATFORM_ADMIN']);
    const body = z.object({ version: z.string().min(1), artifactStorageKey: z.string().min(1), checksumSha256: z.string().length(64), releaseNotes: z.string().min(1), status: z.enum(['DRAFT','READY']).default('DRAFT') }).parse(req.body);
    return prisma.otaRelease.create({ data: body });
  });
  app.post('/ota/releases/:releaseId/assign', async (req) => {
    requireRoles(req, ['PLATFORM_ADMIN']);
    const params = z.object({ releaseId: z.string().uuid() }).parse(req.params);
    const body = z.object({ deviceIds: z.array(z.string().uuid()).min(1) }).parse(req.body);
    await prisma.otaAssignment.createMany({ data: body.deviceIds.map(deviceId => ({ releaseId: params.releaseId, deviceId })), skipDuplicates: true });
    return { assigned: body.deviceIds.length };
  });
}