import { z } from 'zod';

export const DeviceCommandSchema = z.object({
  commandId: z.string().uuid(),
  issuedAt: z.string().datetime(),
  type: z.enum(['SYNC_NOW', 'REBOOT', 'CLEAR_CACHE', 'DOWNLOAD_MEDIA', 'APPLY_SCHEDULE', 'OTA_UPDATE']),
  payload: z.record(z.unknown())
});

export const DeviceHeartbeatSchema = z.object({
  deviceId: z.string().uuid(),
  timestamp: z.string().datetime(),
  firmwareVersion: z.string().min(1),
  agentVersion: z.string().min(1),
  uptimeSeconds: z.number().int().nonnegative(),
  freeDiskBytes: z.number().int().nonnegative(),
  totalDiskBytes: z.number().int().positive(),
  temperatureCelsius: z.number().optional(),
  networkType: z.enum(['ethernet', 'wifi', 'cellular', 'unknown']),
  ipAddress: z.string().optional(),
  currentlyPlayingMediaId: z.string().uuid().optional(),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    occurredAt: z.string().datetime()
  })).default([])
});

export type DeviceCommand = z.infer<typeof DeviceCommandSchema>;
export type DeviceHeartbeat = z.infer<typeof DeviceHeartbeatSchema>;
