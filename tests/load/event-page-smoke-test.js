import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

// Defaults match Phase 12; every load parameter can be changed for the approved target.
function positiveInteger(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

const target = __ENV.EVENT_PAGE_URL;
if (!target || !/^https?:\/\/[^/?#@]+\/(vi|en)\/events\/[^/?#]+\/?$/.test(target)) {
  throw new Error('Set EVENT_PAGE_URL to an absolute localized event overview URL without credentials or a query string');
}
const rate = positiveInteger('SMOKE_RPS', 5);
const durationSeconds = positiveInteger('SMOKE_DURATION_SECONDS', 120);
const preAllocatedVUs = positiveInteger('SMOKE_PREALLOCATED_VUS', 10);
const maxVUs = positiveInteger('SMOKE_MAX_VUS', 50);
if (maxVUs < preAllocatedVUs) throw new Error('SMOKE_MAX_VUS must be at least SMOKE_PREALLOCATED_VUS');
const serverErrors = new Counter('event_page_5xx');

export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    event_page: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration: `${durationSeconds}s`,
      preAllocatedVUs,
      maxVUs,
    },
  },
  thresholds: {
    event_page_5xx: ['count==0'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
  },
};

export default function () {
  const response = http.get(target, {
    redirects: 0,
    timeout: __ENV.SMOKE_REQUEST_TIMEOUT || '10s',
    tags: { name: 'event-overview' },
  });
  serverErrors.add(response.status >= 500 && response.status < 600 ? 1 : 0);
  check(response, { 'event overview returns 200': (result) => result.status === 200 });
}

export function handleSummary(data) {
  return {
    stdout: `${JSON.stringify({
      target,
      rate,
      durationSeconds,
      finishedAt: new Date().toISOString(),
      metrics: data.metrics,
    }, null, 2)}\n`,
  };
}
