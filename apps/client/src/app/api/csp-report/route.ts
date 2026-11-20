export const dynamic = 'force-dynamic';

// Report-only until phase 12 enforces the policy: fixed guards keep a flood of reports from filling the logs.
const MAX_BODY_BYTES = 8 * 1024;
const MAX_LOGS_PER_MINUTE = 30;
let windowStart = 0;
let logged = 0;

type CspReport = Record<string, unknown>;
const isReport = (value: unknown): value is CspReport => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Browsers send either `{ "csp-report": {...} }` (report-uri) or an array of `{ type, body }` (Reporting API). */
function reportsOf(payload: unknown): CspReport[] {
  if (Array.isArray(payload)) return payload.filter(isReport).map((item) => item.body).filter(isReport);
  const legacy = isReport(payload) ? payload['csp-report'] : null;
  return isReport(legacy) ? [legacy] : [];
}

const pick = (report: CspReport, ...keys: string[]) => {
  for (const key of keys) if (typeof report[key] === 'string') return (report[key] as string).slice(0, 300);
  return undefined;
};

// Reports are untrusted: URL paths, query strings and credentials can contain personal data.
function reportOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (['inline', 'eval', 'self', 'none'].includes(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    return ['data:', 'blob:', 'about:'].includes(url.protocol) ? url.protocol : '[redacted]';
  } catch { return '[redacted]'; }
}

function reportDirective(value: string | undefined): string {
  const directive = value?.split(/\s/, 1)[0];
  return directive && /^(?:default-src|script-src(?:-elem|-attr)?|style-src(?:-elem|-attr)?|img-src|font-src|connect-src|frame-src|child-src|worker-src|media-src|manifest-src|object-src|base-uri|form-action|frame-ancestors|upgrade-insecure-requests|block-all-mixed-content|sandbox|trusted-types|require-trusted-types-for)$/.test(directive) ? directive : 'unknown';
}

/** The body as text, or null when it passes the cap (stops reading there; Content-Length is not trusted). */
async function readCapped(request: Request): Promise<string | null> {
  const length = request.headers.get('content-length');
  if (length !== null && Number(length) > MAX_BODY_BYTES) {
    await request.body?.cancel();
    return null;
  }
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(request: Request) {
  const text = await readCapped(request).catch(() => null);
  if (!text) return new Response(null, { status: 204 });
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    logged = 0;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  for (const report of reportsOf(payload)) {
    if (logged >= MAX_LOGS_PER_MINUTE) break;
    logged += 1;
    console.warn(
      JSON.stringify({
        msg: 'csp-violation',
        directive: reportDirective(pick(report, 'effectiveDirective', 'effective-directive', 'violated-directive')),
        blocked: reportOrigin(pick(report, 'blockedURL', 'blocked-uri')),
        page: reportOrigin(pick(report, 'documentURL', 'document-uri')),
      }),
    );
  }
  return new Response(null, { status: 204 });
}
