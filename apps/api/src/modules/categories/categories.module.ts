import { Module } from '@nestjs/common';
import { AdminCategoriesController } from './admin-categories.controller.js';
import { CategoriesService } from './categories.service.js';

@Module({
  controllers: [AdminCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
