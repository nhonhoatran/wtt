import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PUBLIC_PREFIX } from '@kamito/shared/media';
import type { ObjectStorage } from '@kamito/shared/object-storage';
import { Public } from '../access-control/access-decorators.js';
import { OBJECT_STORAGE } from '../storage/object-storage.provider.js';

// "<purpose>/<year>/<uuid>-<width>.webp" is the only shape the worker ever writes under public/.
const PUBLIC_FILE = /^[a-z0-9-]+\/\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d{1,5}\.webp$/;

/** Serves re-encoded variants when MEDIA_PUBLIC_BASE_URL is unset (local dev). Never reaches incoming/. */
@Controller('media/public')
export class MediaPublicFilesController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  @Get('*path')
  @Public()
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async serve(@Param('path') segments: string | string[]): Promise<StreamableFile> {
    const relative = Array.isArray(segments) ? segments.join('/') : segments;
    if (!PUBLIC_FILE.test(relative)) throw new NotFoundException();
    try {
      return new StreamableFile(await this.storage.get(`${PUBLIC_PREFIX}${relative}`), { type: 'image/webp' });
    } catch {
      throw new NotFoundException();
    }
  }
}
