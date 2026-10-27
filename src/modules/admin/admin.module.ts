import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminUsersController } from './admin-users.controller';

@Module({
  controllers: [AdminController, AdminAuthController, AdminUsersController],
  providers: [AdminService, AdminAuthService, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}
