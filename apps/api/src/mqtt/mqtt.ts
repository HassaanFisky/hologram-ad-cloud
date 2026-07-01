import mqtt from 'mqtt';
import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { prisma } from '../common/prisma';

export function connectMqtt(app: FastifyInstance) {
  const client = mqtt.connect(config.MQTT_URL, { username: config.MQTT_USERNAME || undefined, password: config.MQTT_PASSWORD || undefined, clientId: `hololed-api-${process.pid}`, clean: true });
  client.on('connect', () => { client.subscribe('devices/+/acks'); client.subscribe('devices/+/telemetry'); });
  client.on('message', async (topic, payload) => {
    const [, deviceId, channel] = topic.split('/');
    if (!deviceId || !channel) return;
    if (channel === 'acks') {
      const ack = JSON.parse(payload.toString()) as { commandId: string; status: string; errorMessage?: string };
      await prisma.deviceCommand.update({ where: { id: ack.commandId }, data: { status: ack.status, acknowledgedAt: new Date(), errorMessage: ack.errorMessage }}).catch(() => undefined);
    }
    if (channel === 'telemetry') {
      await prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(), status: 'ONLINE' }}).catch(() => undefined);
    }
  });
  app.decorate('mqttPublish', (topic: string, message: string) => client.publish(topic, message, { qos: 1 }));
}
