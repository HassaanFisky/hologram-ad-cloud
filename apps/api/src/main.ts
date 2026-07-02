import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';
import { config } from './config';
import { AppError } from './common/errors';
import { authRoutes } from './auth/routes';
import { companyRoutes } from './companies/routes';
import { deviceRoutes } from './devices/routes';
import { mediaRoutes } from './media/routes';
import { playlistRoutes } from './playlists/routes';
import { scheduleRoutes } from './schedules/routes';
import { groupRoutes } from './groups/routes';
import { customerRoutes } from './customers/routes';
import { analyticsRoutes } from './analytics/routes';
import { otaRoutes } from './ota/routes';
import { healthRoutes } from './health/routes';
import { connectMqtt } from './mqtt/mqtt';

async function build() {
  const app = Fastify({ logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug' }});
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(helmet);
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.setErrorHandler((error, req, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    req.log.error({ err }, 'request failed');
    if (err instanceof AppError) return reply.code(err.statusCode).send({ code: err.code, message: err.message });
    if (err && typeof err === 'object' && 'issues' in err) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues });
    return reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
  });
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(companyRoutes, { prefix: '/api/v1' });
  await app.register(deviceRoutes, { prefix: '/api/v1' });
  await app.register(mediaRoutes, { prefix: '/api/v1' });
  await app.register(playlistRoutes, { prefix: '/api/v1' });
  await app.register(scheduleRoutes, { prefix: '/api/v1' });
  await app.register(groupRoutes, { prefix: '/api/v1' });
  await app.register(customerRoutes, { prefix: '/api/v1' });
  await app.register(analyticsRoutes, { prefix: '/api/v1' });
  await app.register(otaRoutes, { prefix: '/api/v1' });
  app.get('/openapi.json', async () => ({ openapi: '3.1.0', info: { title: 'HoloLED Cloud API', version: '1.0.0' }, servers: [{ url: '/api/v1' }], paths: {} }));
  if (config.MQTT_URL) connectMqtt(app);
  return app;
}

build().then(app => app.listen({ port: config.API_PORT, host: '0.0.0.0' }));