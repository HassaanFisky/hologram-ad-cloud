import { FastifyInstance } from 'fastify';
import { prisma } from '../common/prisma';
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'hololed-api', time: new Date().toISOString() };
  });
}
