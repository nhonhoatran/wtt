import { Module } from '@nestjs/common';
import { AdminMediaController } from './admin-media.controller.js';
import { MediaPublicFilesController } from './media-public-files.controller.js';
import { MediaQueue } from './media-queue.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [AdminMediaController, MediaPublicFilesController],
  providers: [MediaService, MediaQueue],
  exports: [MediaService],
})
export class MediaModule {}
