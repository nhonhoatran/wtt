import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CACHE_TAGS } from '../src/modules/revalidation/cache-tags.js';
import { ROUTE_TAG_RULES } from '../src/modules/revalidation/route-tag-coverage.js';
import { AuthTestKit } from './support/auth-test-kit.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SRC = join(import.meta.dirname, '../src');
const SKIP_SOURCE = new Set(['cache-tags.ts', 'route-tag-coverage.ts']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') && !SKIP_SOURCE.has(name) ? [path] : [];
  });
}

describe('every admin write route is accounted for in the public cache tag map', () => {
  let kit: AuthTestKit;
  let routes: string[];

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    routes = [];
    for (const moduleRef of kit.app.get(ModulesContainer).values()) {
      for (const wrapper of moduleRef.controllers.values()) {
        const controller = wrapper.metatype as (new () => object) | null;
        if (!controller) continue;
        const base = Reflect.getMetadata('path', controller) as string;
        for (const name of Object.getOwnPropertyNames(controller.prototype)) {
          const handler = (controller.prototype as Record<string, unknown>)[name];
          if (name === 'constructor' || typeof handler !== 'function') continue;
          const method = Reflect.getMetadata('method', handler) as number | undefined;
          if (method === undefined || !WRITE_METHODS.has(RequestMethod[method]!)) continue;
          const path = `/${[base, Reflect.getMetadata('path', handler) as string].join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')}`;
          if (path.startsWith('/admin/')) routes.push(`${RequestMethod[method]} ${path}`);
        }
      }
    }
  });

  afterAll(async () => {
    await kit.close();
  });

  it('finds the admin write routes', () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it('has a rule for every route and no rule for a route that is gone', () => {
    expect(routes.filter((route) => !(route in ROUTE_TAG_RULES))).toEqual([]);
    expect(Object.keys(ROUTE_TAG_RULES).filter((route) => !routes.includes(route))).toEqual([]);
  });

  it('only names mutations that exist and that some source file really enqueues', () => {
    const sources = sourceFiles(SRC).map((file) => readFileSync(file, 'utf8')).join('\n');
    const mutations = new Set(Object.values(ROUTE_TAG_RULES).flatMap((rule) => ('tags' in rule ? rule.tags : [])));
    for (const mutation of mutations) {
      expect(mutation in CACHE_TAGS, `${mutation} missing from CACHE_TAGS`).toBe(true);
      expect(sources.includes(`'${mutation}'`), `no source enqueues ${mutation}`).toBe(true);
    }
  });

  it('gives every exemption a reason', () => {
    for (const [route, rule] of Object.entries(ROUTE_TAG_RULES)) {
      if ('none' in rule) expect(rule.none.length, route).toBeGreaterThan(5);
    }
  });
});
