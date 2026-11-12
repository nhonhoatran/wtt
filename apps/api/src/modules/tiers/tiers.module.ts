import { Module } from '@nestjs/common';
import { AdminTiersController } from './admin-tiers.controller.js';
import { TiersService } from './tiers.service.js';

@Module({
  controllers: [AdminTiersController],
  providers: [TiersService],
})
export class TiersModule {}
