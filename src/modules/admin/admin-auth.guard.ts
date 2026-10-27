import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { AdminAuthService } from './admin-auth.service';

// Painel admin: Bearer JWT (login email/password).
// Outros clientes (scripts, serviços): x-admin-token == ADMIN_SECRET.
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private auth: AdminAuthService, private config: ConfigService) {}

  private tokenMatches(given: string): boolean {
    const secret = this.config.get<string>('ADMIN_SECRET');
    if (!secret || !given) return false;
    const a = Buffer.from(given);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();

    const staticToken: string | undefined = req.headers['x-admin-token'];
    if (staticToken) {
      if (this.tokenMatches(staticToken)) return true;
      throw new UnauthorizedException('Invalid admin token');
    }

    const [scheme, token] = String(req.headers['authorization'] ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Autenticação em falta');
    req.admin = this.auth.verify(token);
    return true;
  }
}
