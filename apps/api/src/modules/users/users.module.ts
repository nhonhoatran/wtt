import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller.js';
import { SessionRevocationService } from './session-revocation.service.js';
import { UsersQueryService } from './users-query.service.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [AdminUsersController],
  providers: [UsersService, UsersQueryService, SessionRevocationService],
})
export class UsersModule {}
