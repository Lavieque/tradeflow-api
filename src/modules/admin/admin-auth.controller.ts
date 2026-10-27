import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';

class LoginDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(1) @MaxLength(200) password: string;
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto, @Req() req: any) {
    return this.auth.login(body.email, body.password, req.ip);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: any) {
    return { email: req.admin.email };
  }
}
