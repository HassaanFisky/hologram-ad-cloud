/**
 * @hololed/errors
 * Shared typed errors and error serialization
 */

export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code = 'APP_ERROR') { super(message); }
}
export const notFound = (entity: string) => new AppError(404, `${entity} not found`, 'NOT_FOUND');
export const forbidden = () => new AppError(403, 'Forbidden', 'FORBIDDEN');
export const unauthorized = () => new AppError(401, 'Unauthorized', 'UNAUTHORIZED');

export {};
