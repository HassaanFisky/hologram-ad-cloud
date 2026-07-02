import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '@prisma/client';

export type AccessClaims = { sub: string; companyId?: string | null; role: UserRole; email: string };
export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export function signAccessToken(claims: AccessClaims) { return jwt.sign(claims, config.JWT_ACCESS_SECRET, { expiresIn: '15m' }); }
export function signRefreshToken(userId: string) { return jwt.sign({ sub: userId }, config.JWT_REFRESH_SECRET, { expiresIn: '30d' }); }
export function verifyAccessToken(token: string) { return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessClaims; }