"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceHeartbeatSchema = exports.DeviceCommandSchema = void 0;
const zod_1 = require("zod");
exports.DeviceCommandSchema = zod_1.z.object({
    commandId: zod_1.z.string().uuid(),
    issuedAt: zod_1.z.string().datetime(),
    type: zod_1.z.enum(['SYNC_NOW', 'REBOOT', 'CLEAR_CACHE', 'DOWNLOAD_MEDIA', 'APPLY_SCHEDULE', 'OTA_UPDATE']),
    payload: zod_1.z.record(zod_1.z.unknown())
});
exports.DeviceHeartbeatSchema = zod_1.z.object({
    deviceId: zod_1.z.string().uuid(),
    timestamp: zod_1.z.string().datetime(),
    firmwareVersion: zod_1.z.string().min(1),
    agentVersion: zod_1.z.string().min(1),
    uptimeSeconds: zod_1.z.number().int().nonnegative(),
    freeDiskBytes: zod_1.z.number().int().nonnegative(),
    totalDiskBytes: zod_1.z.number().int().positive(),
    temperatureCelsius: zod_1.z.number().optional(),
    networkType: zod_1.z.enum(['ethernet', 'wifi', 'cellular', 'unknown']),
    ipAddress: zod_1.z.string().optional(),
    currentlyPlayingMediaId: zod_1.z.string().uuid().optional(),
    errors: zod_1.z.array(zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        occurredAt: zod_1.z.string().datetime()
    })).default([])
});
