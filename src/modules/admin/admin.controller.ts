import {
  Controller, Get, Post, Put, Delete, Body, Param,
  Query, HttpCode, UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
  ) {}


  // ── CONTAS ──

  @Get('accounts')
  async listAccounts() {
    return this.admin.listAccounts();
  }

  @Get('accounts/:id')
  async getAccount(@Param('id') id: string) {
    return this.admin.getAccount(id);
  }

  @Post('accounts')
  @HttpCode(201)
  async createAccount(
    @Body() body: { email: string; nome: string; plano_id: string },
  ) {
    return this.admin.createAccount(body.email, body.nome, body.plano_id);
  }

  @Delete('accounts/:id')
  async deleteAccount(
    @Param('id') id: string,
  ) {
    return this.admin.deleteAccount(id);
  }

  @Put('accounts/:id/block')
  async blockAccount(
    @Param('id') id: string,
    @Body() body: { motivo?: string },
  ) {
    return this.admin.blockAccount(id, body.motivo);
  }

  @Put('accounts/:id/unblock')
  async unblockAccount(
    @Param('id') id: string,
  ) {
    return this.admin.unblockAccount(id);
  }

  @Put('accounts/:id/reset-credits')
  async resetCredits(
    @Param('id') id: string,
  ) {
    return this.admin.resetCredits(id);
  }

  @Put('accounts/:id/new-key')
  async newLicenseKey(
    @Param('id') id: string,
  ) {
    return this.admin.newLicenseKey(id);
  }

  @Put('accounts/:id/plan')
  async changePlan(
    @Param('id') id: string,
    @Body() body: { plano_id: string },
  ) {
    return this.admin.changePlan(id, body.plano_id);
  }

  @Put('accounts/:id/renew')
  async renewAccount(
    @Param('id') id: string,
  ) {
    return this.admin.renewAccount(id);
  }

  @Put('accounts/:id/billing-status')
  async setBillingStatus(
    @Param('id') id: string,
    @Body() body: { status: string; motivo?: string },
  ) {
    return this.admin.setBillingStatus(id, body.status as any, body.motivo);
  }

  @Put('accounts/:id/credits/add')
  async addCredits(
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    return this.admin.addCredits(id, body.amount);
  }

  @Put('accounts/:id/credits/used')
  async setCreditsUsed(
    @Param('id') id: string,
    @Body() body: { value: number },
  ) {
    return this.admin.setCreditsUsed(id, body.value);
  }

  @Put('accounts/:id/credits/deduct')
  async deductCredits(
    @Param('id') id: string,
    @Body() body: { amount: number },
  ) {
    return this.admin.deductCredits(id, body.amount ?? 1);
  }

  @Get('accounts/:id/stores')
  async listStores(
    @Param('id') id: string,
  ) {
    return this.admin.listStores(id);
  }

  @Post('accounts/:id/stores')
  @HttpCode(201)
  async createStore(
    @Param('id') id: string,
    @Body() body: { site_url: string; site_nome: string },
  ) {
    return this.admin.createStore(id, body.site_url, body.site_nome);
  }

  @Get('accounts/:id/jobs')
  async listJobs(
    @Param('id') id: string,
  ) {
    return this.admin.listJobs(id);
  }

  // ── PLANOS ──

  @Get('plans')
  async listPlans() {
    return this.admin.listPlans();
  }

  @Put('plans/:id')
  async upsertPlan(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.admin.upsertPlan(id, body);
  }

  // ── LOGS ──

  @Get('logs')
  async listLogs(
    @Query('account_id') accountId?: string,
    @Query('nivel') nivel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listLogs({ accountId, nivel: nivel as any, limit: limit ? parseInt(limit) : 100 });
  }

  // ── JOBS ──

  @Get('jobs')
  async listAllJobs(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listAllJobs({ status, limit: limit ? parseInt(limit) : 50 });
  }

  @Post('jobs/:id/retry')
  async retryJob(
    @Param('id') id: string,
  ) {
    return this.admin.retryJob(id);
  }

  // ── STATS ──

  @Get('stats')
  async getStats() {
    return this.admin.getStats();
  }
}
