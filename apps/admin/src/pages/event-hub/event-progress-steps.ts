/** Counts from GET /admin/events/:id/progress. */
export interface EventProgress {
  subEvents: number;
  entries: { confirmed: number; subEventsReady: number };
  draws: { subEventsDone: number; subEventsStarted: number; total: number };
  matches: { total: number; scheduled: number; official: number };
}

export type ProgressStepStatus = 'finish' | 'process' | 'wait';

export interface ProgressStep {
  key: 'info' | 'sub-events' | 'entries' | 'draws' | 'schedule';
  /** Hub tab the step opens; equals the URL segment. */
  tab: string;
  title: string;
  status: ProgressStepStatus;
  caption: string;
}

const DONE = 'Đã xong';
const NOT_STARTED = 'Chưa bắt đầu';
const working = (detail: string) => `Đang làm · ${detail}`;

/** Indicator only: the API never blocks publishing on these. */
export function eventProgressSteps(progress: EventProgress): ProgressStep[] {
  const { subEvents, entries, draws, matches } = progress;
  const hasSubEvents = subEvents > 0;

  const entriesStep: Pick<ProgressStep, 'status' | 'caption'> =
    hasSubEvents && entries.subEventsReady === subEvents
      ? { status: 'finish', caption: DONE }
      : entries.confirmed > 0
        ? { status: 'process', caption: working(`${entries.subEventsReady}/${subEvents} nội dung đủ VĐV`) }
        : { status: 'wait', caption: NOT_STARTED };

  const drawsStep: Pick<ProgressStep, 'status' | 'caption'> =
    draws.total > 0 && draws.subEventsDone === draws.total
      ? { status: 'finish', caption: DONE }
      : draws.subEventsStarted > 0
        ? { status: 'process', caption: working(`${draws.subEventsDone}/${draws.total} nội dung đã công bố`) }
        : { status: 'wait', caption: NOT_STARTED };

  const scheduleStep: Pick<ProgressStep, 'status' | 'caption'> =
    matches.total > 0 && matches.scheduled === matches.total && draws.total > 0 && draws.subEventsDone === draws.total
      ? { status: 'finish', caption: DONE }
      : matches.scheduled > 0
        ? { status: 'process', caption: working(`${matches.scheduled}/${matches.total} trận`) }
        : { status: 'wait', caption: NOT_STARTED };

  return [
    { key: 'info', tab: 'info', title: 'Thông tin', status: 'finish', caption: DONE },
    {
      key: 'sub-events',
      tab: 'sub-events',
      title: 'Nội dung thi đấu',
      status: hasSubEvents ? 'finish' : 'wait',
      caption: hasSubEvents ? `${DONE} · ${subEvents} nội dung` : NOT_STARTED,
    },
    { key: 'entries', tab: 'entries', title: 'Danh sách đăng ký', ...entriesStep },
    { key: 'draws', tab: 'draws', title: 'Bốc thăm', ...drawsStep },
    { key: 'schedule', tab: 'schedule', title: 'Lịch thi đấu', ...scheduleStep },
  ];
}

export function remainingStepsText(steps: ProgressStep[]): string {
  const remaining = steps.filter((step) => step.status !== 'finish').length;
  return remaining === 0 ? `Đã xong cả ${steps.length} bước chuẩn bị` : `Còn ${remaining} bước chưa xong`;
}
