import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT, s3ClientProvider } from './s3-client.provider.js';

@Global()
@Module({
  providers: [s3ClientProvider],
  exports: [S3_CLIENT],
})
export class StorageModule implements OnModuleDestroy {
  constructor(@Inject(S3_CLIENT) private readonly s3: S3Client) {}

  onModuleDestroy(): void {
    this.s3.destroy();
  }
}
