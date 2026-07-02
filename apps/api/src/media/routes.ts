import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../common/prisma';
import { config } from '../config';
import { requireCompanyAccess, authenticate } from '../auth/rbac';
import { audit } from '../audit/audit.service';

const s3 = new S3Client({ endpoint: config.S3_ENDPOINT, region: config.S3_REGION, forcePathStyle: config.S3_FORCE_PATH_STYLE, credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY }});

export async function mediaRoutes(app: FastifyInstance) {
  app.post('/companies/:companyId/media/presign-upload', async (req) => {
    const user = authenticate(req);
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    const body = z.object({ filename: z.string().min(1), mimeType: z.enum(['image/png','image/jpeg','image/webp','video/mp4','text/html']), sizeBytes: z.number().int().positive().max(2_000_000_000), type: z.enum(['IMAGE','VIDEO','HTML']) }).parse(req.body);
    const mediaId = crypto.randomUUID();
    const key = `companies/${params.companyId}/media/${mediaId}/original/${body.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const checksum = crypto.createHash('sha256').update(`${mediaId}:${body.filename}:${body.sizeBytes}`).digest('hex');
    const asset = await prisma.mediaAsset.create({ data: { id: mediaId, companyId: params.companyId, uploadedByUserId: user.sub, type: body.type, originalFilename: body.filename, mimeType: body.mimeType, sizeBytes: BigInt(body.sizeBytes), checksumSha256: checksum, storageKeyOriginal: key }});
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: key, ContentType: body.mimeType }), { expiresIn: 900 });
    await audit({companyId: params.companyId, actorUserId: user.sub, action: 'UPLOAD_MEDIA', entityType: 'MediaAsset', entityId: asset.id, metadata: {filename: body.filename}});
    return { mediaAssetId: asset.id, uploadUrl, storageKey: key };
  });

  app.post('/media/:mediaAssetId/mark-uploaded', async (req) => {
    const user = authenticate(req);
    const params = z.object({ mediaAssetId: z.string().uuid() }).parse(req.params);
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: params.mediaAssetId }});
    if (user.role !== 'PLATFORM_ADMIN' && user.companyId !== asset.companyId) throw new Error('Forbidden');
    const optimizedKey = asset.storageKeyOriginal;
    return prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: 'READY', storageKeyOptimized: optimizedKey }});
  });

  app.get('/companies/:companyId/media', async (req) => {
    const params = z.object({ companyId: z.string().uuid() }).parse(req.params);
    requireCompanyAccess(req, params.companyId);
    return prisma.mediaAsset.findMany({ where: { companyId: params.companyId }, orderBy: { createdAt: 'desc' }});
  });

  app.get('/media/:mediaAssetId/download-url', async (req) => {
    const user = authenticate(req);
    const params = z.object({ mediaAssetId: z.string().uuid() }).parse(req.params);
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: params.mediaAssetId }});
    if (user.role !== 'PLATFORM_ADMIN' && user.companyId !== asset.companyId) throw new Error('Forbidden');
    const key = asset.storageKeyOptimized ?? asset.storageKeyOriginal;
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }), { expiresIn: 900 });
    return { url };
  });
}