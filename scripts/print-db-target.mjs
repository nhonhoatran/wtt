#!/usr/bin/env node
// Prints the DB target (password hidden). With --confirm, exits non-zero unless
// MIGRATE_CONFIRM_TARGET equals "host:port/database" of DATABASE_URL.
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function describeDbTarget(databaseUrl) {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return {
    host: url.hostname,
    port: url.port || '5432',
    database,
    user: decodeURIComponent(url.username),
    confirmKey: `${url.hostname}:${url.port || '5432'}/${database}`,
  };
}

export function isTargetConfirmed(target, confirmValue) {
  return typeof confirmValue === 'string' && confirmValue.trim() === target.confirmKey;
}

function main() {
  // Only uncommented assignments are read; process.loadEnvFile skips "#" lines.
  if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error('DATABASE_URL is not set');
    process.exit(2);
  }
  const target = describeDbTarget(raw);
  console.log(`DB target: ${target.host}:${target.port}/${target.database} (user: ${target.user}, password hidden)`);

  if (process.argv.includes('--confirm')) {
    if (!isTargetConfirmed(target, process.env.MIGRATE_CONFIRM_TARGET)) {
      console.error(`MIGRATE_CONFIRM_TARGET must equal "${target.confirmKey}" — refusing to migrate`);
      process.exit(3);
    }
    console.log('DB target confirmed');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
