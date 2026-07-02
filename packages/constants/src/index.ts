/**
 * @hololed/constants
 * Shared platform constants, limits, MIME allowlists, protocol values
 */

export const PLATFORM_NAME = 'HoloLED Cloud';
export const MAX_MEDIA_SIZE_BYTES = 2_000_000_000;
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'text/html'] as const;
export const MQTT_TOPICS = {
  commands: (deviceId: string) => `devices/${deviceId}/commands`,
  telemetry: (deviceId: string) => `devices/${deviceId}/telemetry`,
  acks: (deviceId: string) => `devices/${deviceId}/acks`,
} as const;

export {};
