import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../common/prisma';
import { requireCompanyAccess, requireRoles, authenticate } from '../auth/rbac';
import { AppError, notFound } from '../common/errors';
import { audit } from '../audit/audit.service';
import { DeviceHeartbeatSchema } from '@hololed/shared';

function hashCode(code: string) { return crypto.createHash('sha256').update(code).digest('hex'); }
function pairingCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

export async function deviceRoutes(app: FastifyInstance) {
  app.get('/companies/:companyId/devices', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.device.findMany({ where: { companyId: params.companyId }, orderBy: { createdAt: 'desc' }});
  });

  app.post('/companies/:companyId/devices', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    const actor = requireRoles(req, ['PLATFORM_ADMIN','COMPANY_ADMIN','OPERATIONS_MANAGER','INSTALLER']);
    if (actor.role !== 'PLATFORM_ADMIN' && actor.companyId !== params.companyId) throw new AppError(403, 'Forbidden');
    const body = z.object({ name: z.string().min(2), serialNumber: z.string().min(3), hardwareVendor: z.string().optional(), hardwareModel: z.string().optional(), address: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() }).parse(req.body);
    const code = pairingCode();
    const device = await prisma.device.create({ data: { ...body, latitude: body.latitude, longitude: body.longitude, companyId: params.companyId, pairingCodeHash: hashCode(code), mqttClientId: `device-${body.serialNumber}` }});
    await audit({companyId: params.companyId, actorUserId: actor.sub, action: 'CREATE', entityType: 'Device', entityId: device.id, metadata: {serialNumber: body.serialNumber}});
    return { device, pairingCode: code };
  });

  app.post('/devices/pair', async (req) => {
    const body = z.object({ serialNumber: z.string(), pairingCode: z.string(), agentVersion: z.string(), firmwareVersion: z.string() }).parse(req.body);
    const device = await prisma.device.findUnique({ where: { serialNumber: body.serialNumber }});
    if (!device || !device.pairingCodeHash || device.pairingCodeHash !== hashCode(body.pairingCode)) throw new AppError(401, 'Invalid pairing credentials', 'INVALID_PAIRING');
    const updated = await prisma.device.update({ where: { id: device.id }, data: { status: 'ONLINE', pairedAt: new Date(), lastSeenAt: new Date(), pairingCodeHash: null, agentVersion: body.agentVersion, firmwareVersion: body.firmwareVersion }});
    await audit({companyId: device.companyId, action: 'PAIR_DEVICE', entityType: 'Device', entityId: device.id, metadata: {serialNumber: body.serialNumber}});
    return { deviceId: updated.id, mqttClientId: updated.mqttClientId, topics: { commands: `devices/${updated.id}/commands`, telemetry: `devices/${updated.id}/telemetry`, ack: `devices/${updated.id}/acks` }};
  });

  app.post('/devices/:deviceId/heartbeat', async (req) => {
    const params = z.object({ deviceId: z.string().uuid() }).parse(req.params);
    const body = DeviceHeartbeatSchema.parse(req.body);
    if (body.deviceId !== params.deviceId) throw new AppError(400, 'Heartbeat deviceId mismatch', 'DEVICE_ID_MISMATCH');
    const device = await prisma.device.findUnique({ where: { id: params.deviceId }});
    if (!device) throw notFound('Device');
    await prisma.$transaction([
      prisma.deviceHeartbeat.create({ data: { deviceId: params.deviceId, payload: body }}),
      prisma.device.update({ where: { id: params.deviceId }, data: { status: body.errors.length ? 'DEGRADED' : 'ONLINE', lastSeenAt: new Date(), firmwareVersion: body.firmwareVersion, agentVersion: body.agentVersion }})
    ]);
    return { accepted: true };
  });

  app.post('/devices/:deviceId/commands', async (req) => {
    const user = authenticate(req);
    const params = z.object({ deviceId: z.string().uuid() }).parse(req.params);
    const body = z.object({ type: z.enum(['SYNC_NOW','REBOOT','CLEAR_CACHE','APPLY_SCHEDULE','OTA_UPDATE']), payload: z.record(z.unknown()).default({}) }).parse(req.body);
    const device = await prisma.device.findUnique({ where: { id: params.deviceId }});
    if (!device) throw notFound('Device');
    if (user.role !== 'PLATFORM_ADMIN' && user.companyId !== device.companyId) throw new AppError(403, 'Forbidden');
    const command = await prisma.deviceCommand.create({ data: { deviceId: device.id, type: body.type, payload: body.payload }});
    app.mqttPublish?.(`devices/${device.id}/commands`, JSON.stringify({ commandId: command.id, issuedAt: command.issuedAt.toISOString(), type: command.type, payload: command.payload }));
    await audit({companyId: device.companyId, actorUserId: user.sub, action: 'COMMAND_DEVICE', entityType: 'DeviceCommand', entityId: command.id, metadata: {type: command.type}});
    return command;
  });
}
