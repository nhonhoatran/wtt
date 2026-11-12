import { Module } from '@nestjs/common';
import { AdminDisciplinesController } from './admin-disciplines.controller.js';
import { DisciplinesService } from './disciplines.service.js';

@Module({
  controllers: [AdminDisciplinesController],
  providers: [DisciplinesService],
})
export class DisciplinesModule {}
