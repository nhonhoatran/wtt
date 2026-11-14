/** Error shape Refine understands: statusCode + message, field errors under `errors`. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly errors?: Record<string, string>,
    readonly retryAfterSeconds?: number,
    readonly dependants?: Record<string, number>,
    readonly issues?: { code: string; message: string; playerId?: string; overridable: boolean }[],
    readonly preview?: unknown,
  ) {
    super(message);
  }
}

let apiBase = '/api/v1';

export function setApiBase(base: string): void {
  apiBase = base.replace(/\/$/, '');
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: Record<string, string>; dependants?: Record<string, number>; issues?: ApiError['issues']; preview?: unknown };
  code?: string;
  message?: string;
}

/** Same-origin JSON calls; the session is an HttpOnly cookie, so no token ever touches JS. */
export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  const body = (await res.json().catch(() => ({}))) as T & ErrorBody;
  if (res.ok) return body;
  // Our API nests errors under `error`; Better Auth's raw routes return { code, message }.
  const error = body.error ?? { code: body.code, message: body.message };
  const retryAfter = Number(res.headers.get('retry-after')) || undefined;
  throw new ApiError(res.status, error.code ?? `HTTP_${res.status}`, error.message ?? res.statusText, error.fields, retryAfter, error.dependants, 'issues' in error ? error.issues : undefined, 'preview' in error ? error.preview : undefined);
}
