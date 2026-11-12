import { createObjectStorage } from '@kamito/shared/object-storage';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export const objectStorageProvider = {
  provide: OBJECT_STORAGE,
  inject: [API_ENV],
  useFactory: (env: ApiEnv) => createObjectStorage(env),
};
