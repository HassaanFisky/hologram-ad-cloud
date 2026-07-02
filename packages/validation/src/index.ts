/**
 * @hololed/validation
 * Shared validation schemas and input normalization helpers
 */

import { z } from 'zod';

export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email().toLowerCase();
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export {};
