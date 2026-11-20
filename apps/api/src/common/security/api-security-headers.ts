import helmet, { type HelmetOptions } from 'helmet';
import type { Express } from 'express';

const API_HELMET_OPTIONS: HelmetOptions = {
  // Browser CSP is set at the site/proxy layer, not on JSON/media or the bull-board UI.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  hsts: { maxAge: 15_552_000, includeSubDomains: false, preload: false },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
};

export function applyApiSecurityHeaders(app: Pick<Express, 'use'>): void {
  app.use(helmet(API_HELMET_OPTIONS));
}
