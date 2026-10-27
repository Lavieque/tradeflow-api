import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode,
  NotFoundException, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../firebase/firebase.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { hashPassword } from './admin-auth.service';

class CreateAdminDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(12) @MaxLength(200) password: string;
  @IsOptional() @IsString() @MaxLength(100) nome?: string;
}

class PasswordDto {
  @IsString() @MinLength(12) @MaxLength(200) password: string;
}

class ActiveDto {
  @IsBoolean() activo: boolean;
}

const publicView = (u: any) => ({
  id: u.id, email: u.email, nome: u.nome ?? null, activo: u.activo,
  ultimo_login: u.ultimo_login ?? null, criado_em: u.criado_em ?? null,
});

@UseGuards(AdminAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private firebase: FirebaseService) {}

  @Get()
  async list() {
    return (await this.firebase.listAdminUsers()).map(publicView);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreateAdminDto) {
    const email = body.email.trim().toLowerCase();
    if (await this.firebase.getAdminUserByEmail(email)) {
      throw new ConflictException('Já existe um admin com este email');
    }
    const id = await this.firebase.createAdminUser({
      email,
      nome: body.nome ?? null,
      password_hash: await hashPassword(body.password),
      activo: true,
    });
    return { id, email };
  }

  @Put(':id/password')
  async setPassword(@Param('id') id: string, @Body() body: PasswordDto) {
    if (!(await this.firebase.getAdminUser(id))) throw new NotFoundException('Admin não encontrado');
    await this.firebase.updateAdminUser(id, { password_hash: await hashPassword(body.password) });
    return { ok: true };
  }

  @Put(':id/active')
  async setActive(@Param('id') id: string, @Body() body: ActiveDto, @Req() req: any) {
    if (req.admin?.sub === id && !body.activo) {
      throw new BadRequestException('Não podes desactivar a tua própria conta');
    }
    if (!(await this.firebase.getAdminUser(id))) throw new NotFoundException('Admin não encontrado');
    await this.firebase.updateAdminUser(id, { activo: body.activo });
    return { ok: true };
  }
}
