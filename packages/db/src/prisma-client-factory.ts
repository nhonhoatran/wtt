import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export interface CreatePrismaClientOptions {
  connectionString: string;
  log?: Array<'query' | 'info' | 'warn' | 'error'>;
}

export function buildPrismaClientOptions(options: CreatePrismaClientOptions) {
  return {
    adapter: new PrismaPg({ connectionString: options.connectionString }),
    log: options.log ?? [],
  };
}

export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  return new PrismaClient(buildPrismaClientOptions(options));
}
