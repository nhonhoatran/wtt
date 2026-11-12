import { S3Client } from '@aws-sdk/client-s3';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const S3_CLIENT = Symbol('S3_CLIENT');

export function createS3Client(env: ApiEnv): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}

export const s3ClientProvider = {
  provide: S3_CLIENT,
  inject: [API_ENV],
  useFactory: createS3Client,
};
