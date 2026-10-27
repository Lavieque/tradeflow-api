import { Injectable, Logger, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHmac } from 'crypto';
import { promisify } from 'util';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../firebase/firebase.service';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const TOKEN_TTL_S = 12 * 60 * 60;
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export interface AdminJwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private attempts = new Map<string, { count: number; first: number }>();
  // hash válido só para gastar tempo quando o email não existe (evita enumeração por timing)
  private dummyHash: Promise<string> = hashPassword('dummy-password');

  constructor(private config: ConfigService, private firebase: FirebaseService) {}

  private secret(): string {
    const s = this.config.get<string>('JWT_SECRET');
    if (!s || s.length < 32) throw new Error('JWT_SECRET em falta ou curto (mín. 32 chars)');
    return s;
  }

  private sign(payload: AdminJwtPayload): string {
    const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64u(JSON.stringify(payload));
    const sig = createHmac('sha256', this.secret()).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${sig}`;
  }

  verify(token: string): AdminJwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Token inválido');
    const [head, body, sig] = parts;
    const expected = createHmac('sha256', this.secret()).update(`${head}.${body}`).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('Token inválido');
    }
    let payload: AdminJwtPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Sessão expirada');
    }
    return payload;
  }

  private checkRateLimit(key: string) {
    const rec = this.attempts.get(key);
    if (rec && Date.now() - rec.first > WINDOW_MS) this.attempts.delete(key);
    const cur = this.attempts.get(key);
    if (cur && cur.count >= MAX_ATTEMPTS) {
      throw new HttpException('Demasiadas tentativas. Tenta novamente mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private registerFailure(key: string) {
    const cur = this.attempts.get(key);
    if (cur) cur.count++;
    else this.attempts.set(key, { count: 1, first: Date.now() });
  }

  async login(emailRaw: string, password: string, ip: string) {
    const email = (emailRaw ?? '').trim().toLowerCase();
    const key = `${ip}|${email}`;
    this.checkRateLimit(key);

    const user = email ? await this.firebase.getAdminUserByEmail(email) : null;
    const ok = user
      ? await verifyPassword(password ?? '', user.password_hash)
      : (await verifyPassword(password ?? '', await this.dummyHash), false);

    if (!user || !ok || !user.activo) {
      this.registerFailure(key);
      this.logger.warn(`Login admin falhou: ${email || '(vazio)'} ip=${ip}`);
      throw new UnauthorizedException('Email ou password inválidos');
    }

    this.attempts.delete(key);
    await this.firebase.updateAdminUser(user.id, {
      ultimo_login: admin.firestore.FieldValue.serverTimestamp(),
    });

    const iat = Math.floor(Date.now() / 1000);
    const token = this.sign({ sub: user.id, email: user.email, iat, exp: iat + TOKEN_TTL_S });
    return { token, expires_in: TOKEN_TTL_S, email: user.email, nome: user.nome ?? null };
  }
}
