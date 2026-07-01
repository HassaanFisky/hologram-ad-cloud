import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { requireCompanyAccess, authenticate } from '../auth/rbac';
import { audit } from '../audit/audit.service';

export async function scheduleRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/schedules', async (req) => {
    const user = authenticate(req);
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({
      name: z.string().min(2), playlistId: z.string().uuid(), campaignId: z.string().uuid().optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), timezone: z.string().default('Asia/Karachi'),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1), startMinuteOfDay: z.number().int().min(0).max(1439), endMinuteOfDay: z.number().int().min(1).max(1440), priority: z.number().int().min(1).max(1000).default(100),
      targetDeviceIds: z.array(z.string().uuid()).default([]), targetGroupIds: z.array(z.string().uuid()).default([]), status: z.enum(['DRAFT','ACTIVE','PAUSED']).default('DRAFT')
    }).parse(req.body);
    if (new Date(body.endsAt) <= new Date(body.startsAt)) throw new Error('Schedule end must be after start');
    const schedule = await prisma.schedule.create({ data: { companyId: params.companyId, name: body.name, playlistId: body.playlistId, campaignId: body.campaignId, startsAt: body.startsAt, endsAt: body.endsAt, timezone: body.timezone, daysOfWeek: body.daysOfWeek, startMinuteOfDay: body.startMinuteOfDay, endMinuteOfDay: body.endMinuteOfDay, priority: body.priority, status: body.status, targetDevices: { create: body.targetDeviceIds.map(deviceId => ({ deviceId })) }, targetGroups: { create: body.targetGroupIds.map(groupId => ({ groupId })) }} });
    await audit({companyId: params.companyId, actorUserId: user.sub, action: 'SCHEDULE_CONTENT', entityType: 'Schedule', entityId: schedule.id, metadata: {status: schedule.status}});
    return schedule;
  });

  app.get('/companies/:companyId/schedules', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.schedule.findMany({ where: { companyId: params.companyId }, include: { targetDevices: true, targetGroups: true }, orderBy: { createdAt: 'desc' }});
  });

  app.get('/devices/:deviceId/sync-manifest', async (req) => {
    const params = z.object({ deviceId: z.string().uuid() }).parse(req.params);
    const device = await prisma.device.findUniqueOrThrow({ where: { id: params.deviceId }, include: { groups: true }});
    const groupIds = device.groups.map(g => g.groupId);
    const schedules = await prisma.schedule.findMany({ where: { companyId: device.companyId, status: 'ACTIVE', OR: [{ targetDevices: { some: { deviceId: device.id }}}, { targetGroups: { some: { groupId: { in: groupIds }}}}] }, include: { playlist: { include: { items: { include: { mediaAsset: true }, orderBy: { orderIndex: 'asc' }}}}}});
    return { deviceId: device.id, generatedAt: new Date().toISOString(), schedules: schedules.map(s => ({ id: s.id, name: s.name, timezone: s.timezone, startsAt: s.startsAt, endsAt: s.endsAt, daysOfWeek: s.daysOfWeek, startMinuteOfDay: s.startMinuteOfDay, endMinuteOfDay: s.endMinuteOfDay, priority: s.priority, playlist: s.playlist.items.map(i => ({ mediaAssetId: i.mediaAssetId, durationSeconds: i.durationSeconds, storageKey: i.mediaAsset.storageKeyOptimized ?? i.mediaAsset.storageKeyOriginal, checksumSha256: i.mediaAsset.checksumSha256, mimeType: i.mediaAsset.mimeType })) })) };
  });
}
