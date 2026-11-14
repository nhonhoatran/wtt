export const dynamic = 'force-dynamic';

// Report-only until phase 12 enforces the policy: fixed guards keep a flood of reports from filling the logs.
const MAX_BODY_BYTES = 8 * 1024;
const MAX_LOGS_PER_MINUTE = 30;
let windowStart = 0;
let logged = 0;

type CspReport = Record<string, unknown>;

/** Browsers send either `{ "csp-report": {...} }` (report-uri) or an array of `{ type, body }` (Reporting API). */
function reportsOf(payload: unknown): CspReport[] {
  if (Array.isArray(payload)) return payload.map((item) => (item as { body?: CspReport }).body).filter((body): body is CspReport => Boolean(body));
  const legacy = (payload as { 'csp-report'?: CspReport } | null)?.['csp-report'];
  return legacy ? [legacy] : [];
}

const pick = (report: CspReport, ...keys: string[]) => {
  for (const key of keys) if (typeof report[key] === 'string') return (report[key] as string).slice(0, 300);
  return undefined;
};

/** The body as text, or null when it passes the cap (stops reading there; Content-Length is not trusted). */
async function readCapped(request: Request): Promise<string | null> {
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
        directive: pick(report, 'effectiveDirective', 'effective-directive', 'violated-directive'),
        blocked: pick(report, 'blockedURL', 'blocked-uri'),
        page: pick(report, 'documentURL', 'document-uri'),
      }),
    );
  }
  return new Response(null, { status: 204 });
}
