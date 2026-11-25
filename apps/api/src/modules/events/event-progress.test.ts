import { describe, expect, it } from 'vitest';
import { isDrawDone, requiredDrawKinds, summarizeProgress, type ProgressSubEvent } from './event-progress.js';

const knockout = (draws: ProgressSubEvent['draws'] = []): ProgressSubEvent => ({ format: 'KNOCKOUT', hasQualifying: false, draws });

describe('event progress', () => {
  it('requires GROUP for group formats and QUALIFYING when enabled', () => {
    expect(requiredDrawKinds({ format: 'KNOCKOUT', hasQualifying: false })).toEqual(['MAIN']);
    expect(requiredDrawKinds({ format: 'GROUP_KNOCKOUT', hasQualifying: true }).sort()).toEqual(['GROUP', 'MAIN', 'QUALIFYING']);
  });

  it('treats a sub-event as drawn only when every required draw is published', () => {
    expect(isDrawDone(knockout([{ kind: 'MAIN', status: 'DRAFT' }]))).toBe(false);
    expect(isDrawDone(knockout([{ kind: 'MAIN', status: 'PUBLISHED' }]))).toBe(true);
    const grouped: ProgressSubEvent = { format: 'GROUP_KNOCKOUT', hasQualifying: false, draws: [{ kind: 'MAIN', status: 'PUBLISHED' }] };
    expect(isDrawDone(grouped)).toBe(false);
  });

  it('summarizes counts', () => {
    const result = summarizeProgress(
      [knockout([{ kind: 'MAIN', status: 'PUBLISHED' }]), knockout([{ kind: 'MAIN', status: 'DRAFT' }]), knockout()],
      [8, 1, 0],
      { total: 10, unscheduled: 4, official: 2 },
    );
    expect(result).toEqual({
      subEvents: 3,
      entries: { confirmed: 9, subEventsReady: 1 },
      draws: { subEventsDone: 1, subEventsStarted: 2, total: 3 },
      matches: { total: 10, scheduled: 6, official: 2 },
    });
  });
});
