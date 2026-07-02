/**
 * @hololed/logger
 * Structured logging configuration and request/device log context helpers
 */

import pino from 'pino';
export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
export type Logger = pino.Logger;

export {};
