import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { S3ObjectStorage, type ObjectStorage } from '@kamito/shared/object-storage';
import { OBJECT_STORAGE, objectStorageProvider } from './object-storage.provider.js';

@Global()
@Module({
  providers: [objectStorageProvider],
  exports: [OBJECT_STORAGE],
})
export class StorageModule implements OnModuleDestroy {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  onModuleDestroy(): void {
    if (this.storage instanceof S3ObjectStorage) this.storage.destroy();
  }
}
