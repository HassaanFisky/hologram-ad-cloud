import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess } from '../auth/rbac';

export async function playlistRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/playlists', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ name: z.string().min(2), items: z.array(z.object({ mediaAssetId: z.string().uuid(), durationSeconds: z.number().int().min(1).max(86400) })).min(1) }).parse(req.body);
    return prisma.playlist.create({ data: { companyId: params.companyId, name: body.name, items: { create: body.items.map((item, index) => ({ mediaAssetId: item.mediaAssetId, durationSeconds: item.durationSeconds, orderIndex: index })) }}, include: { items: true }});
  });
  app.get('/companies/:companyId/playlists', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.playlist.findMany({ where: { companyId: params.companyId }, include: { items: true }, orderBy: { createdAt: 'desc' }});
  });
}