import { z } from 'zod';
export declare const DeviceCommandSchema: z.ZodObject<{
    commandId: z.ZodString;
    issuedAt: z.ZodString;
    type: z.ZodEnum<["SYNC_NOW", "REBOOT", "CLEAR_CACHE", "DOWNLOAD_MEDIA", "APPLY_SCHEDULE", "OTA_UPDATE"]>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: "SYNC_NOW" | "REBOOT" | "CLEAR_CACHE" | "DOWNLOAD_MEDIA" | "APPLY_SCHEDULE" | "OTA_UPDATE";
    commandId: string;
    issuedAt: string;
    payload: Record<string, unknown>;
}, {
    type: "SYNC_NOW" | "REBOOT" | "CLEAR_CACHE" | "DOWNLOAD_MEDIA" | "APPLY_SCHEDULE" | "OTA_UPDATE";
    commandId: string;
    issuedAt: string;
    payload: Record<string, unknown>;
}>;
export declare const DeviceHeartbeatSchema: z.ZodObject<{
    deviceId: z.ZodString;
    timestamp: z.ZodString;
    firmwareVersion: z.ZodString;
    agentVersion: z.ZodString;
    uptimeSeconds: z.ZodNumber;
    freeDiskBytes: z.ZodNumber;
    totalDiskBytes: z.ZodNumber;
    temperatureCelsius: z.ZodOptional<z.ZodNumber>;
    networkType: z.ZodEnum<["ethernet", "wifi", "cellular", "unknown"]>;
    ipAddress: z.ZodOptional<z.ZodString>;
    currentlyPlayingMediaId: z.ZodOptional<z.ZodString>;
    errors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        occurredAt: string;
    }, {
        code: string;
        message: string;
        occurredAt: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    timestamp: string;
    firmwareVersion: string;
    agentVersion: string;
    uptimeSeconds: number;
    freeDiskBytes: number;
    totalDiskBytes: number;
    networkType: "unknown" | "ethernet" | "wifi" | "cellular";
    errors: {
        code: string;
        message: string;
        occurredAt: string;
    }[];
    ipAddress?: string | undefined;
    temperatureCelsius?: number | undefined;
    currentlyPlayingMediaId?: string | undefined;
}, {
    deviceId: string;
    timestamp: string;
    firmwareVersion: string;
    agentVersion: string;
    uptimeSeconds: number;
    freeDiskBytes: number;
    totalDiskBytes: number;
    networkType: "unknown" | "ethernet" | "wifi" | "cellular";
    ipAddress?: string | undefined;
    temperatureCelsius?: number | undefined;
    currentlyPlayingMediaId?: string | undefined;
    errors?: {
        code: string;
        message: string;
        occurredAt: string;
    }[] | undefined;
}>;
export type DeviceCommand = z.infer<typeof DeviceCommandSchema>;
export type DeviceHeartbeat = z.infer<typeof DeviceHeartbeatSchema>;
