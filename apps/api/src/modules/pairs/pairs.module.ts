import { Module } from '@nestjs/common';
import { AdminPairsController } from './admin-pairs.controller.js';
import { PairsService } from './pairs.service.js';

@Module({
  controllers: [AdminPairsController],
  providers: [PairsService],
})
export class PairsModule {}
